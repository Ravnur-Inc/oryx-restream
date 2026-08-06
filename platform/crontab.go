// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/ossrs/go-oryx-lib/errors"
	"github.com/ossrs/go-oryx-lib/logger"
)

var crontabWorker *CrontabWorker

type CrontabWorker struct {
	wg sync.WaitGroup
}

func NewCrontabWorker() *CrontabWorker {
	return &CrontabWorker{}
}

func (v *CrontabWorker) Close() error {
	v.wg.Wait()
	return nil
}

func (v *CrontabWorker) Start(ctx context.Context) error {
	v.wg.Add(1)
	go func() {
		defer v.wg.Done()

		for {
			if err := fastCache.Refresh(ctx); err != nil {
				logger.Wf(ctx, "crontab: refresh fast cache err %v", err)
			}

			select {
			case <-ctx.Done():
				return
			case <-time.After(3 * time.Second):
			}
		}
	}()

	v.wg.Add(1)
	go func() {
		defer v.wg.Done()

		for {
			if err := reconcileActiveStreams(ctx); err != nil {
				logger.Wf(ctx, "crontab: reconcile active streams err %v", err)
			}

			select {
			case <-ctx.Done():
				return
			case <-time.After(10 * time.Second):
			}
		}
	}()

	if err := certManager.Initialize(ctx); err != nil {
		return errors.Wrapf(err, "initialize cert manager")
	}

	v.wg.Add(1)
	go func() {
		defer v.wg.Done()

		for {
			logger.Tf(ctx, "crontab: start to refresh certificate file")
			if err := certManager.reloadCertificateFile(ctx); err != nil {
				logger.Wf(ctx, "crontab: ignore err %v", err)
			}

			select {
			case <-ctx.Done():
				return
			case <-certManager.httpCertificateReload:
			case <-time.After(time.Duration(1*3600) * time.Second):
			}
		}
	}()

	return nil
}

// Entries in SRS_STREAM_ACTIVE are added by on_publish and removed by on_unpublish
// (see srs-hooks.go), with no TTL. If SRS exits without unpublishing — a crash, or the
// deliberate restart srt.go performs to apply an SRT encryption change — the hash keeps
// entries for publishers that are long gone. The UI reads that hash verbatim for its
// live/idle badge, and forward.go picks its FFmpeg input from it, so a phantom entry
// shows a dead channel as HEALTHY and keeps a forward task chasing a stream that ended.
//
// This is a garbage collector, not a registrar: it only removes entries SRS no longer
// knows about. Re-adding publishers SRS has but the hash lacks would let a stream whose
// on_publish was rejected become visible and forwarded, so we never do that.
const reconcileGracePeriod = 30 * time.Second

func reconcileActiveStreams(ctx context.Context) error {
	live, err := srsActivePublishers(ctx)
	if err != nil {
		// SRS unreachable or restarting: leave the hash alone rather than wiping it.
		return errors.Wrapf(err, "query srs publishers")
	}

	entries, err := rdb.HGetAll(ctx, SRS_STREAM_ACTIVE).Result()
	if err != nil && err != redis.Nil {
		return errors.Wrapf(err, "hgetall %v", SRS_STREAM_ACTIVE)
	}

	for streamURL, value := range entries {
		var stream SrsStream
		if err := json.Unmarshal([]byte(value), &stream); err != nil {
			logger.Wf(ctx, "crontab: ignore corrupt %v %v, err %v", SRS_STREAM_ACTIVE, streamURL, err)
			continue
		}

		if live[fmt.Sprintf("%v/%v", stream.App, stream.Stream)] {
			continue
		}

		// A publish that started moments ago may not be visible in the SRS stats yet.
		// Never evict inside the grace window, or we would fight the hook we just ran.
		if at, err := time.Parse(time.RFC3339, stream.Update); err == nil && time.Since(at) < reconcileGracePeriod {
			continue
		}

		hashes := []string{SRS_STREAM_ACTIVE}
		if stream.IsSRT() {
			hashes = append(hashes, SRS_STREAM_SRT_ACTIVE)
		}
		if stream.IsRTC() {
			hashes = append(hashes, SRS_STREAM_RTC_ACTIVE)
		}
		for _, hash := range hashes {
			if err := rdb.HDel(ctx, hash, streamURL).Err(); err != nil && err != redis.Nil {
				return errors.Wrapf(err, "hdel %v %v", hash, streamURL)
			}
		}
		logger.Tf(ctx, "crontab: evict stale stream %v, no publisher in SRS, %v", streamURL, stream.String())
	}

	return nil
}

// srsActivePublishers returns the "<app>/<stream>" of every stream SRS currently has a
// live publisher for. Keyed on app/stream rather than SrsStream.StreamURL() on purpose:
// the SRS stats API reports the vhost *id* (e.g. "vid-4k2s96p"), not its name, so the
// vhost component cannot be reconstructed from it.
func srsActivePublishers(ctx context.Context) (map[string]bool, error) {
	cl := &http.Client{Timeout: 3 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://127.0.0.1:1985/api/v1/streams", nil)
	if err != nil {
		return nil, errors.Wrapf(err, "new request")
	}

	res, err := cl.Do(req)
	if err != nil {
		return nil, errors.Wrapf(err, "do request")
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, errors.Errorf("status %v", res.StatusCode)
	}

	b, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, errors.Wrapf(err, "read body")
	}

	var parsed struct {
		Code    int `json:"code"`
		Streams []struct {
			Name    string `json:"name"`
			App     string `json:"app"`
			Publish struct {
				Active bool `json:"active"`
			} `json:"publish"`
		} `json:"streams"`
	}
	if err := json.Unmarshal(b, &parsed); err != nil {
		return nil, errors.Wrapf(err, "unmarshal %v", string(b))
	}
	if parsed.Code != 0 {
		return nil, errors.Errorf("invalid code=%v, body=%v", parsed.Code, string(b))
	}

	publishers := map[string]bool{}
	for _, s := range parsed.Streams {
		if s.Publish.Active {
			publishers[fmt.Sprintf("%v/%v", s.App, s.Name)] = true
		}
	}
	return publishers, nil
}
