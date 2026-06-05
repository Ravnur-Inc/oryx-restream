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

var destinationManager *DestinationManager

// DestinationManager is a library of reusable forward targets (a server + stream
// key + label). Channels attach a destination to forward their stream to it. The
// library entry is the source of truth: editing it propagates to the live forward
// config(s) that reference it (by DestinationID).
type DestinationManager struct{}

func NewDestinationManager() *DestinationManager {
	return &DestinationManager{}
}

// Destination is a reusable forward target.
type Destination struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Server    string `json:"server"`
	Secret    string `json:"secret"`
	CreatedAt string `json:"createdAt"`
}

func (v *Destination) String() string {
	return fmt.Sprintf("id=%v, label=%v, server=%v", v.ID, v.Label, v.Server)
}

func normalizeServer(s string) string { return strings.TrimRight(strings.TrimSpace(s), "/") }

func (v *DestinationManager) Handle(ctx context.Context, handler *http.ServeMux) error {
	ep := "/terraform/v1/mgmt/destinations"
	logger.Tf(ctx, "Handle %v", ep)
	handler.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		if err := func() error {
			var token, action string
			var req Destination
			if err := ParseBody(ctx, r.Body, &struct {
				Token  *string `json:"token"`
				Action *string `json:"action"`
				*Destination
			}{
				Token: &token, Action: &action, Destination: &req,
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
				if err := validateDestinationFields(&req); err != nil {
					return err
				}
				if exists, err := v.targetExists(ctx, req.Server, req.Secret, ""); err != nil {
					return errors.Wrapf(err, "check target")
				} else if exists {
					return errors.Errorf("a destination with this server and stream key already exists")
				}

				dest := Destination{
					ID:        uuid.NewString(),
					Label:     strings.TrimSpace(req.Label),
					Server:    strings.TrimSpace(req.Server),
					Secret:    strings.TrimSpace(req.Secret),
					CreatedAt: time.Now().Format(time.RFC3339),
				}
				b, err := json.Marshal(&dest)
				if err != nil {
					return errors.Wrapf(err, "marshal destination")
				}
				if err := rdb.HSet(ctx, SRS_DESTINATIONS, dest.ID, string(b)).Err(); err != nil && err != redis.Nil {
					return errors.Wrapf(err, "hset %v %v", SRS_DESTINATIONS, dest.ID)
				}

				ohttp.WriteData(ctx, w, r, dest)
				logger.Tf(ctx, "Destinations create ok, dest=%v, token=%vB", dest.String(), len(token))

			case "update":
				if req.ID == "" {
					return errors.New("id is required")
				}
				if err := validateDestinationFields(&req); err != nil {
					return err
				}
				raw, err := rdb.HGet(ctx, SRS_DESTINATIONS, req.ID).Result()
				if err == redis.Nil {
					return errors.Errorf("destination %v not found", req.ID)
				} else if err != nil {
					return errors.Wrapf(err, "hget %v %v", SRS_DESTINATIONS, req.ID)
				}
				var current Destination
				if err := json.Unmarshal([]byte(raw), &current); err != nil {
					return errors.Wrapf(err, "unmarshal destination")
				}
				if exists, err := v.targetExists(ctx, req.Server, req.Secret, req.ID); err != nil {
					return errors.Wrapf(err, "check target")
				} else if exists {
					return errors.Errorf("a destination with this server and stream key already exists")
				}

				current.Label = strings.TrimSpace(req.Label)
				current.Server = strings.TrimSpace(req.Server)
				current.Secret = strings.TrimSpace(req.Secret)
				b, err := json.Marshal(&current)
				if err != nil {
					return errors.Wrapf(err, "marshal destination")
				}
				if err := rdb.HSet(ctx, SRS_DESTINATIONS, current.ID, string(b)).Err(); err != nil && err != redis.Nil {
					return errors.Wrapf(err, "hset %v %v", SRS_DESTINATIONS, current.ID)
				}

				// Propagate the new server/secret/label to any live forward config
				// that references this destination, and restart its task.
				if n, err := v.propagate(ctx, &current); err != nil {
					return errors.Wrapf(err, "propagate")
				} else {
					logger.Tf(ctx, "Destinations update ok, dest=%v, propagated=%v, token=%vB", current.String(), n, len(token))
				}
				ohttp.WriteData(ctx, w, r, current)

			case "delete":
				if req.ID == "" {
					return errors.New("id is required")
				}
				// Block deletion while attached to any channel/forward.
				if bound, err := v.boundStreams(ctx, req.ID); err != nil {
					return errors.Wrapf(err, "check bound")
				} else if len(bound) > 0 {
					return errors.Errorf("destination is attached to: %v; detach it from those channels first", strings.Join(bound, ", "))
				}
				if err := rdb.HDel(ctx, SRS_DESTINATIONS, req.ID).Err(); err != nil && err != redis.Nil {
					return errors.Wrapf(err, "hdel %v %v", SRS_DESTINATIONS, req.ID)
				}
				ohttp.WriteData(ctx, w, r, nil)
				logger.Tf(ctx, "Destinations delete ok, id=%v, token=%vB", req.ID, len(token))

			default: // list
				dests, err := v.listDestinations(ctx)
				if err != nil {
					return errors.Wrapf(err, "list destinations")
				}
				ohttp.WriteData(ctx, w, r, dests)
				logger.Tf(ctx, "Destinations list ok, count=%v, token=%vB", len(dests), len(token))
			}

			return nil
		}(); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	})

	return nil
}

func validateDestinationFields(d *Destination) error {
	if strings.TrimSpace(d.Label) == "" {
		return errors.New("label is required")
	}
	if strings.TrimSpace(d.Server) == "" {
		return errors.New("server is required")
	}
	return nil
}

// targetExists reports whether another destination has the same server + secret.
func (v *DestinationManager) targetExists(ctx context.Context, server, secret, excludeID string) (bool, error) {
	all, err := rdb.HGetAll(ctx, SRS_DESTINATIONS).Result()
	if err != nil && err != redis.Nil {
		return false, errors.Wrapf(err, "hgetall %v", SRS_DESTINATIONS)
	}
	ns, sec := normalizeServer(server), strings.TrimSpace(secret)
	for _, raw := range all {
		var d Destination
		if err := json.Unmarshal([]byte(raw), &d); err != nil {
			continue
		}
		if d.ID != excludeID && normalizeServer(d.Server) == ns && strings.TrimSpace(d.Secret) == sec {
			return true, nil
		}
	}
	return false, nil
}

// boundStreams returns the source streams (channel names) of forward configs that
// reference this destination.
func (v *DestinationManager) boundStreams(ctx context.Context, destID string) ([]string, error) {
	configs, err := rdb.HGetAll(ctx, SRS_FORWARD_CONFIG).Result()
	if err != nil && err != redis.Nil {
		return nil, errors.Wrapf(err, "hgetall %v", SRS_FORWARD_CONFIG)
	}
	var streams []string
	for _, raw := range configs {
		var c ForwardConfigure
		if err := json.Unmarshal([]byte(raw), &c); err != nil {
			continue
		}
		if c.DestinationID == destID {
			name := c.Stream
			if name == "" {
				name = c.Label
			}
			streams = append(streams, name)
		}
	}
	return streams, nil
}

// propagate updates server/secret/label on forward configs referencing the
// destination, and restarts their running tasks. Returns the count updated.
func (v *DestinationManager) propagate(ctx context.Context, dest *Destination) (int, error) {
	configs, err := rdb.HGetAll(ctx, SRS_FORWARD_CONFIG).Result()
	if err != nil && err != redis.Nil {
		return 0, errors.Wrapf(err, "hgetall %v", SRS_FORWARD_CONFIG)
	}
	count := 0
	for platform, raw := range configs {
		var c ForwardConfigure
		if err := json.Unmarshal([]byte(raw), &c); err != nil {
			continue
		}
		if c.DestinationID != dest.ID {
			continue
		}
		c.Server, c.Secret, c.Label = dest.Server, dest.Secret, dest.Label
		b, err := json.Marshal(&c)
		if err != nil {
			return count, errors.Wrapf(err, "marshal config")
		}
		if err := rdb.HSet(ctx, SRS_FORWARD_CONFIG, platform, string(b)).Err(); err != nil && err != redis.Nil {
			return count, errors.Wrapf(err, "hset %v %v", SRS_FORWARD_CONFIG, platform)
		}
		if forwardWorker != nil {
			if task := forwardWorker.GetTask(platform); task != nil {
				if err := task.Restart(ctx); err != nil {
					logger.Wf(ctx, "destinations: restart task %v err %v", platform, err)
				}
			}
		}
		count++
	}
	return count, nil
}

func (v *DestinationManager) listDestinations(ctx context.Context) ([]*Destination, error) {
	all, err := rdb.HGetAll(ctx, SRS_DESTINATIONS).Result()
	if err != nil && err != redis.Nil {
		return nil, errors.Wrapf(err, "hgetall %v", SRS_DESTINATIONS)
	}
	dests := make([]*Destination, 0, len(all))
	for _, raw := range all {
		var d Destination
		if err := json.Unmarshal([]byte(raw), &d); err != nil {
			return nil, errors.Wrapf(err, "unmarshal destination")
		}
		dests = append(dests, &d)
	}
	sort.Slice(dests, func(i, j int) bool { return dests[i].CreatedAt < dests[j].CreatedAt })
	return dests, nil
}
