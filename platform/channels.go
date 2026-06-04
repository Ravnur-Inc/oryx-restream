// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	// From ossrs.
	"github.com/ossrs/go-oryx-lib/errors"
	ohttp "github.com/ossrs/go-oryx-lib/http"
	"github.com/ossrs/go-oryx-lib/logger"

	// Use v8 because we use Go 1.16+, while v9 requires Go 1.18+
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
)

var channelManager *ChannelManager

// ChannelManager handles CRUD for saved ingest channels stored in Redis. A
// channel is a reusable, named ingest: a stream name plus a human label and
// description, so operators can re-use the same ingest (and keep Forward source
// bindings stable) across repeated streams.
type ChannelManager struct{}

func NewChannelManager() *ChannelManager {
	return &ChannelManager{}
}

// Channel is a saved ingest profile.
type Channel struct {
	ID          string `json:"id"`
	// Name is the SRS stream name used to publish (live/<name>).
	Name        string `json:"name"`
	// Label is the human-friendly display name, e.g. "Sunday Service".
	Label       string `json:"label"`
	Description string `json:"description"`
	CreatedAt   string `json:"createdAt"`
}

func (v *Channel) String() string {
	return fmt.Sprintf("id=%v, name=%v, label=%v", v.ID, v.Name, v.Label)
}

func (v *ChannelManager) Handle(ctx context.Context, handler *http.ServeMux) error {
	ep := "/terraform/v1/mgmt/channels"
	logger.Tf(ctx, "Handle %v", ep)
	handler.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		if err := func() error {
			var token, action string
			var req Channel
			if err := ParseBody(ctx, r.Body, &struct {
				Token  *string `json:"token"`
				Action *string `json:"action"`
				*Channel
			}{
				Token: &token, Action: &action, Channel: &req,
			}); err != nil {
				return errors.Wrapf(err, "parse body")
			}

			apiSecret := envApiSecret()
			if err := Authenticate(ctx, apiSecret, token, r.Header); err != nil {
				return errors.Wrapf(err, "authenticate")
			}

			allowedActions := []string{"create", "update", "delete"}
			if action != "" && !slicesContains(allowedActions, action) {
				return errors.Errorf("invalid action=%v", action)
			}

			switch action {
			case "create":
				if err := validateChannelFields(&req); err != nil {
					return err
				}
				if exists, err := v.nameExists(ctx, req.Name, ""); err != nil {
					return errors.Wrapf(err, "check name")
				} else if exists {
					return errors.Errorf("a channel with stream name %v already exists", req.Name)
				}

				channel := Channel{
					ID:          uuid.NewString(),
					Name:        strings.TrimSpace(req.Name),
					Label:       strings.TrimSpace(req.Label),
					Description: strings.TrimSpace(req.Description),
					CreatedAt:   time.Now().Format(time.RFC3339),
				}
				b, err := json.Marshal(&channel)
				if err != nil {
					return errors.Wrapf(err, "marshal channel")
				}
				if err := rdb.HSet(ctx, SRS_CHANNELS, channel.ID, string(b)).Err(); err != nil && err != redis.Nil {
					return errors.Wrapf(err, "hset %v %v", SRS_CHANNELS, channel.ID)
				}

				ohttp.WriteData(ctx, w, r, channel)
				logger.Tf(ctx, "Channels create ok, channel=%v, token=%vB", channel.String(), len(token))

			case "update":
				if req.ID == "" {
					return errors.New("id is required")
				}
				if err := validateChannelFields(&req); err != nil {
					return err
				}

				raw, err := rdb.HGet(ctx, SRS_CHANNELS, req.ID).Result()
				if err == redis.Nil {
					return errors.Errorf("channel %v not found", req.ID)
				} else if err != nil {
					return errors.Wrapf(err, "hget %v %v", SRS_CHANNELS, req.ID)
				}
				var current Channel
				if err := json.Unmarshal([]byte(raw), &current); err != nil {
					return errors.Wrapf(err, "unmarshal channel")
				}

				if exists, err := v.nameExists(ctx, req.Name, req.ID); err != nil {
					return errors.Wrapf(err, "check name")
				} else if exists {
					return errors.Errorf("a channel with stream name %v already exists", req.Name)
				}

				current.Name = strings.TrimSpace(req.Name)
				current.Label = strings.TrimSpace(req.Label)
				current.Description = strings.TrimSpace(req.Description)

				b, err := json.Marshal(&current)
				if err != nil {
					return errors.Wrapf(err, "marshal channel")
				}
				if err := rdb.HSet(ctx, SRS_CHANNELS, current.ID, string(b)).Err(); err != nil && err != redis.Nil {
					return errors.Wrapf(err, "hset %v %v", SRS_CHANNELS, current.ID)
				}

				ohttp.WriteData(ctx, w, r, current)
				logger.Tf(ctx, "Channels update ok, channel=%v, token=%vB", current.String(), len(token))

			case "delete":
				if req.ID == "" {
					return errors.New("id is required")
				}
				if err := rdb.HDel(ctx, SRS_CHANNELS, req.ID).Err(); err != nil && err != redis.Nil {
					return errors.Wrapf(err, "hdel %v %v", SRS_CHANNELS, req.ID)
				}

				ohttp.WriteData(ctx, w, r, nil)
				logger.Tf(ctx, "Channels delete ok, id=%v, token=%vB", req.ID, len(token))

			default: // list
				channels, err := v.listChannels(ctx)
				if err != nil {
					return errors.Wrapf(err, "list channels")
				}
				ohttp.WriteData(ctx, w, r, channels)
				logger.Tf(ctx, "Channels list ok, count=%v, token=%vB", len(channels), len(token))
			}

			return nil
		}(); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	})

	return nil
}

func validateChannelFields(c *Channel) error {
	if strings.TrimSpace(c.Label) == "" {
		return errors.New("label is required")
	}
	name := strings.TrimSpace(c.Name)
	if name == "" {
		return errors.New("name (stream name) is required")
	}
	if len(name) > 100 || !isValidPlatformKey(name) {
		return errors.Errorf("invalid name=%v, must be alphanumeric with hyphens or underscores, max 100 chars", name)
	}
	return nil
}

func (v *ChannelManager) nameExists(ctx context.Context, name, excludeID string) (bool, error) {
	all, err := rdb.HGetAll(ctx, SRS_CHANNELS).Result()
	if err != nil && err != redis.Nil {
		return false, errors.Wrapf(err, "hgetall %v", SRS_CHANNELS)
	}
	for _, raw := range all {
		var c Channel
		if err := json.Unmarshal([]byte(raw), &c); err != nil {
			continue
		}
		if strings.EqualFold(c.Name, name) && c.ID != excludeID {
			return true, nil
		}
	}
	return false, nil
}

func (v *ChannelManager) listChannels(ctx context.Context) ([]*Channel, error) {
	all, err := rdb.HGetAll(ctx, SRS_CHANNELS).Result()
	if err != nil && err != redis.Nil {
		return nil, errors.Wrapf(err, "hgetall %v", SRS_CHANNELS)
	}
	channels := make([]*Channel, 0, len(all))
	for _, raw := range all {
		var c Channel
		if err := json.Unmarshal([]byte(raw), &c); err != nil {
			return nil, errors.Wrapf(err, "unmarshal channel")
		}
		channels = append(channels, &c)
	}
	sort.Slice(channels, func(i, j int) bool {
		return channels[i].CreatedAt < channels[j].CreatedAt
	})
	return channels, nil
}
