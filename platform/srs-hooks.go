//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ossrs/go-oryx-lib/errors"
	ohttp "github.com/ossrs/go-oryx-lib/http"
	"github.com/ossrs/go-oryx-lib/logger"
	// Use v8 because we use Go 1.16+, while v9 requires Go 1.18+
	"github.com/go-redis/redis/v8"
)

type SrsAction string

const (
	// The actions for SRS server and Oryx.
	// The publish action.
	SrsActionOnPublish SrsAction = "on_publish"
	// The unpublish action.
	SrsActionOnUnpublish = "on_unpublish"

	// The hls action, for SRS server only.
	SrsActionOnHls = "on_hls"

	// The on_record_begin action.
	SrsActionOnRecordBegin = "on_record_begin"
	// The on_record_end action.
	SrsActionOnRecordEnd = "on_record_end"

	// The on_ocr action.
	SrsActionOnOcr = "on_ocr"
)

func handleHooksService(ctx context.Context, handler *http.ServeMux) error {
	versionHandler := func(w http.ResponseWriter, r *http.Request) {
		ohttp.WriteData(ctx, w, r, &struct {
			Version string `json:"version"`
		}{
			Version: strings.TrimPrefix(version, "v"),
		})
	}

	ep := "/terraform/v1/hooks/versions"
	logger.Tf(ctx, "Handle %v", ep)
	handler.HandleFunc(ep, versionHandler)

	// See https://ossrs.io/lts/en-us/docs/v5/doc/http-callback
	ep = "/terraform/v1/hooks/srs/verify"
	logger.Tf(ctx, "Handle %v", ep)
	handler.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		if err := func() error {
			if noAuth, err := rdb.HGet(ctx, SRS_AUTH_SECRET, "pubNoAuth").Result(); err != nil && err != redis.Nil {
				return errors.Wrapf(err, "hget %v pubNoAuth", SRS_AUTH_SECRET)
			} else if noAuth == "true" {
				ohttp.WriteData(ctx, w, r, nil)
				logger.Tf(ctx, "srs hooks disabled")
				return nil
			}

			b, err := ioutil.ReadAll(r.Body)
			if err != nil {
				return errors.Wrapf(err, "read body")
			}
			requestBody := string(b)

			var action SrsAction
			var streamObj SrsStream
			if err := json.Unmarshal(b, &struct {
				Action *SrsAction `json:"action"`
				*SrsStream
			}{
				Action: &action, SrsStream: &streamObj,
			}); err != nil {
				return errors.Wrapf(err, "json unmarshal %v", string(b))
			}

			verifiedBy := "noVerify"
			if action == SrsActionOnPublish {
				// Note that we allow pass secret by params or in stream name, for example, some encoder does not support params
				// with ?secret=xxx, so it will fail when url is:
				//      rtmp://ip/live/livestream?secret=xxx
				// so user could change the url to bellow to get around of it:
				//      rtmp://ip/live/livestreamxxx
				// or simply use secret as stream:
				//      rtmp://ip/live/xxx
				// in this situation, the secret is part of stream name.
				isSecretOK := func(publish, stream, param string) bool {
					return publish == "" || strings.Contains(param, publish) || strings.Contains(stream, publish)
				}

				// Use live room secret to verify if stream name matches.
				roomPublishAuthKey := GenerateRoomPublishKey(streamObj.Stream)
				publish, err := rdb.HGet(ctx, SRS_AUTH_SECRET, roomPublishAuthKey).Result()
				verifiedBy = "room"
				if publish == "" {
					// Use global publish secret to verify
					publish, err = rdb.HGet(ctx, SRS_AUTH_SECRET, "pubSecret").Result()
					verifiedBy = "global"
				}
				if err != nil && err != redis.Nil {
					return errors.Wrapf(err, "hget %v pubSecret", SRS_AUTH_SECRET)
				}
				if !isSecretOK(publish, streamObj.Stream, streamObj.Param) {
					return errors.Errorf("invalid normal stream=%v, param=%v, action=%v", streamObj.Stream, streamObj.Param, action)
				}
			}

			// Verify some actions, before all other hooks.
			preAllHook := action == SrsActionOnPublish
			if preAllHook {
				if err := callbackWorker.OnStreamMessage(ctx, action, &streamObj); err != nil {
					return errors.Wrapf(err, "callback action=%v", action)
				}
			}

			// Automatically add by SRS.
			streamURL := streamObj.StreamURL()
			if action == SrsActionOnPublish {
				streamObj.Update = time.Now().Format(time.RFC3339)

				b, err := json.Marshal(&streamObj)
				if err != nil {
					return errors.Wrapf(err, "marshal json")
				} else if err = rdb.HSet(ctx, SRS_STREAM_ACTIVE, streamURL, string(b)).Err(); err != nil && err != redis.Nil {
					return errors.Wrapf(err, "hset %v %v %v", SRS_STREAM_ACTIVE, streamURL, string(b))
				}

				if err := rdb.HIncrBy(ctx, SRS_STAT_COUNTER, "publish", 1).Err(); err != nil && err != redis.Nil {
					return errors.Wrapf(err, "hincrby %v publish 1", SRS_STAT_COUNTER)
				}
				if streamObj.IsSRT() {
					if err := rdb.HSet(ctx, SRS_STREAM_SRT_ACTIVE, streamURL, string(b)).Err(); err != nil && err != redis.Nil {
						return errors.Wrapf(err, "hset %v %v %v", SRS_STREAM_SRT_ACTIVE, streamURL, string(b))
					}
				}
				if streamObj.IsRTC() {
					if err := rdb.HSet(ctx, SRS_STREAM_RTC_ACTIVE, streamURL, string(b)).Err(); err != nil && err != redis.Nil {
						return errors.Wrapf(err, "hset %v %v %v", SRS_STREAM_RTC_ACTIVE, streamURL, string(b))
					}
				}
			} else if action == SrsActionOnUnpublish {
				if err := rdb.HDel(ctx, SRS_STREAM_ACTIVE, streamURL).Err(); err != nil && err != redis.Nil {
					return errors.Wrapf(err, "hset %v %v", SRS_STREAM_ACTIVE, streamURL)
				}
				if streamObj.IsSRT() {
					if err := rdb.HDel(ctx, SRS_STREAM_SRT_ACTIVE, streamURL).Err(); err != nil && err != redis.Nil {
						return errors.Wrapf(err, "hset %v %v", SRS_STREAM_SRT_ACTIVE, streamURL)
					}
				}
				if streamObj.IsRTC() {
					if err := rdb.HDel(ctx, SRS_STREAM_RTC_ACTIVE, streamURL).Err(); err != nil && err != redis.Nil {
						return errors.Wrapf(err, "hset %v %v", SRS_STREAM_RTC_ACTIVE, streamURL)
					}
				}
			} else if action == "on_play" {
				if err := rdb.HIncrBy(ctx, SRS_STAT_COUNTER, "play", 1).Err(); err != nil && err != redis.Nil {
					return errors.Wrapf(err, "hincrby %v play 1", SRS_STAT_COUNTER)
				}
			}

			// For some events, hook after all other hooks are done.
			if !preAllHook {
				if err := callbackWorker.OnStreamMessage(ctx, action, &streamObj); err != nil {
					return errors.Wrapf(err, "callback action=%v", action)
				}
			}

			ohttp.WriteData(ctx, w, r, nil)
			logger.Tf(ctx, "srs hooks ok, action=%v, verifiedBy=%v, %v, %v",
				action, verifiedBy, streamObj.String(), requestBody)
			return nil
		}(); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	})

	secretQueryHandler := func(w http.ResponseWriter, r *http.Request) {
		if err := func() error {
			var token string
			if err := ParseBody(ctx, r.Body, &struct {
				Token *string `json:"token"`
			}{
				Token: &token,
			}); err != nil {
				return errors.Wrapf(err, "parse body")
			}

			apiSecret := envApiSecret()
			if err := Authenticate(ctx, apiSecret, token, r.Header); err != nil {
				return errors.Wrapf(err, "authenticate")
			}

			publish, err := rdb.HGet(ctx, SRS_AUTH_SECRET, "pubSecret").Result()
			if err != nil && err != redis.Nil {
				return errors.Wrapf(err, "hget %v pubSecret", SRS_AUTH_SECRET)
			}
			if publish == "" {
				return errors.New("system not boot yet")
			}

			ohttp.WriteData(ctx, w, r, &struct {
				Publish string `json:"publish"`
			}{
				Publish: publish,
			})
			logger.Tf(ctx, "srs secret ok ok, token=%vB", len(token))
			return nil
		}(); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	}

	ep = "/terraform/v1/hooks/srs/secret"
	logger.Tf(ctx, "Handle %v", ep)
	handler.HandleFunc(ep, secretQueryHandler)

	ep = "/terraform/v1/hooks/srs/secret/query"
	logger.Tf(ctx, "Handle %v", ep)
	handler.HandleFunc(ep, secretQueryHandler)

	ep = "/terraform/v1/hooks/srs/secret/update"
	logger.Tf(ctx, "Handle %v", ep)
	handler.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		if err := func() error {
			var token, secret string
			if err := ParseBody(ctx, r.Body, &struct {
				Token  *string `json:"token"`
				Secret *string `json:"secret"`
			}{
				Token: &token, Secret: &secret,
			}); err != nil {
				return errors.Wrapf(err, "parse body")
			}

			apiSecret := envApiSecret()
			if err := Authenticate(ctx, apiSecret, token, r.Header); err != nil {
				return errors.Wrapf(err, "authenticate")
			}

			if secret == "" {
				return errors.New("no secret")
			}

			if err := rdb.HSet(ctx, SRS_AUTH_SECRET, "pubSecret", secret).Err(); err != nil {
				return errors.Wrapf(err, "hset %v pubSecret %v", SRS_AUTH_SECRET, secret)
			}
			if err := rdb.Set(ctx, SRS_SECRET_PUBLISH, secret, 0).Err(); err != nil {
				return errors.Wrapf(err, "set %v %v", SRS_SECRET_PUBLISH, secret)
			}

			ohttp.WriteData(ctx, w, r, nil)
			logger.Tf(ctx, "hooks update secret, secret=%vB, token=%vB", len(secret), len(token))
			return nil
		}(); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	})

	ep = "/terraform/v1/hooks/srs/secret/disable"
	logger.Tf(ctx, "Handle %v", ep)
	handler.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		if err := func() error {
			var token string
			var pubNoAuth bool
			if err := ParseBody(ctx, r.Body, &struct {
				Token     *string `json:"token"`
				PubNoAuth *bool   `json:"pubNoAuth"`
			}{
				Token: &token, PubNoAuth: &pubNoAuth,
			}); err != nil {
				return errors.Wrapf(err, "parse body")
			}

			apiSecret := envApiSecret()
			if err := Authenticate(ctx, apiSecret, token, r.Header); err != nil {
				return errors.Wrapf(err, "authenticate")
			}

			if err := rdb.HSet(ctx, SRS_AUTH_SECRET, "pubNoAuth", fmt.Sprintf("%v", pubNoAuth)).Err(); err != nil {
				return errors.Wrapf(err, "hset %v pubSecret %v", SRS_AUTH_SECRET, pubNoAuth)
			}

			ohttp.WriteData(ctx, w, r, nil)
			logger.Tf(ctx, "hooks disable secret, pubNoAuth=%v, token=%vB", pubNoAuth, len(token))
			return nil
		}(); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	})

	if err := handleOnHls(ctx, handler); err != nil {
		return errors.Wrapf(err, "handle hooks")
	}

	return nil
}

func handleOnHls(ctx context.Context, handler *http.ServeMux) error {
	// TODO: FIXME: Fixed token.
	// See https://github.com/ossrs/srs/wiki/v4_EN_HTTPCallback
	ep := "/terraform/v1/hooks/srs/hls"
	logger.Tf(ctx, "Handle %v", ep)
	handler.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		if err := func() error {
			b, err := ioutil.ReadAll(r.Body)
			if err != nil {
				return errors.Wrapf(err, "read body")
			}

			var msg SrsOnHlsMessage
			if err := json.Unmarshal(b, &msg); err != nil {
				return errors.Wrapf(err, "json unmarshal %v", string(b))
			}
			if msg.Action != SrsActionOnHls {
				return errors.Errorf("invalid action=%v", msg.Action)
			}
			if _, err := os.Stat(msg.File); err != nil {
				return errors.Wrapf(err, "invalid ts file %v", msg.File)
			}
			logger.Tf(ctx, "on_hls ok, %v", string(b))

			ohttp.WriteData(ctx, w, r, nil)
			return nil
		}(); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	})

	return nil
}
