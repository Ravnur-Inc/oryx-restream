// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
package main

import (
	"context"
	"crypto/rand"
	"net/http"
	"os"
	"path"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"

	// From ossrs.
	"github.com/ossrs/go-oryx-lib/errors"
	ohttp "github.com/ossrs/go-oryx-lib/http"
	"github.com/ossrs/go-oryx-lib/logger"

	// Use v8 because we use Go 1.16+, while v9 requires Go 1.18+
	"github.com/go-redis/redis/v8"
)

// SRS_SRT_ENCRYPT is the Redis hash holding the runtime SRT encryption state
// (enabled/passphrase/pbkeylen). It is the source of truth for the Ingest-page
// toggle, and is seeded once (in memory) from the deploy-time
// SRS_SRT_SERVER_PASSPHRASE env for backward compatibility.
const SRS_SRT_ENCRYPT = "SRS_SRT_ENCRYPT"

var srtManager *SrtManager

// SrtManager owns the runtime SRT encryption toggle. Turning it on/off rewrites
// the SRS env file the launcher sources (containers/data/config/.srs.env) and
// restarts SRS so the new srt_server passphrase takes effect.
type SrtManager struct{}

func NewSrtManager() *SrtManager { return &SrtManager{} }

// SrtEncryptConfig is the persisted/effective SRT encryption state.
type SrtEncryptConfig struct {
	Enabled    bool   `json:"enabled"`
	Passphrase string `json:"passphrase"`
	Pbkeylen   string `json:"pbkeylen"`
}

// Alphanumeric only, 10-79 chars: safe inside the KEY=VALUE .srs.env (parsed via
// xargs) and SRS's env override, and within SRT's passphrase length limits.
var srtPassphrasePattern = regexp.MustCompile(`^[A-Za-z0-9]{10,79}$`)

func normalizePbkeylen(v string) string {
	switch strings.TrimSpace(v) {
	case "24":
		return "24"
	case "32":
		return "32"
	default:
		return "16"
	}
}

// generateSrtPassphrase returns a 32-char alphanumeric passphrase (CSPRNG).
func generateSrtPassphrase() (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", errors.Wrapf(err, "read random")
	}
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(b), nil
}

// load returns the effective SRT config. If Redis has no state yet, it seeds (in
// memory, not persisted) from the deploy-time env so existing encrypted
// deployments keep working and surface their passphrase in the UI.
func (v *SrtManager) load(ctx context.Context) (SrtEncryptConfig, error) {
	vals, err := rdb.HGetAll(ctx, SRS_SRT_ENCRYPT).Result()
	if err != nil && err != redis.Nil {
		return SrtEncryptConfig{}, errors.Wrapf(err, "hgetall %v", SRS_SRT_ENCRYPT)
	}
	if len(vals) == 0 {
		if p := envSrtPassphrase(); p != "" {
			return SrtEncryptConfig{Enabled: true, Passphrase: p, Pbkeylen: normalizePbkeylen(envSrtPbkeylen())}, nil
		}
		return SrtEncryptConfig{Enabled: false, Passphrase: "", Pbkeylen: "16"}, nil
	}
	return SrtEncryptConfig{
		Enabled:    vals["enabled"] == "true",
		Passphrase: vals["passphrase"],
		Pbkeylen:   normalizePbkeylen(vals["pbkeylen"]),
	}, nil
}

func (v *SrtManager) save(ctx context.Context, cfg SrtEncryptConfig) error {
	enabled := "false"
	if cfg.Enabled {
		enabled = "true"
	}
	if err := rdb.HSet(ctx, SRS_SRT_ENCRYPT, map[string]interface{}{
		"enabled":    enabled,
		"passphrase": cfg.Passphrase,
		"pbkeylen":   cfg.Pbkeylen,
	}).Err(); err != nil && err != redis.Nil {
		return errors.Wrapf(err, "hset %v", SRS_SRT_ENCRYPT)
	}
	return nil
}

// writeSrsEnv regenerates the env file auto/start_srs sources before launching
// SRS. We always write both SRT vars (empty when disabled) so the file fully
// overrides any inherited deploy-time -e env. Non-SRT lines are preserved.
func (v *SrtManager) writeSrsEnv(ctx context.Context, cfg SrtEncryptConfig) error {
	fileName := path.Join(conf.Pwd, "containers/data/config/.srs.env")

	var kept []string
	if b, err := os.ReadFile(fileName); err == nil {
		for _, line := range strings.Split(string(b), "\n") {
			t := strings.TrimSpace(line)
			if t == "" {
				continue
			}
			if strings.HasPrefix(t, "SRS_SRT_SERVER_PASSPHRASE=") || strings.HasPrefix(t, "SRS_SRT_SERVER_PBKEYLEN=") {
				continue
			}
			kept = append(kept, line)
		}
	}

	passphrase, pbkeylen := "", ""
	if cfg.Enabled {
		passphrase, pbkeylen = cfg.Passphrase, cfg.Pbkeylen
	}
	lines := append(kept,
		"SRS_SRT_SERVER_PASSPHRASE="+passphrase,
		"SRS_SRT_SERVER_PBKEYLEN="+pbkeylen,
	)
	data := strings.Join(lines, "\n") + "\n"

	if err := os.MkdirAll(path.Dir(fileName), 0755); err != nil {
		return errors.Wrapf(err, "mkdir %v", path.Dir(fileName))
	}
	if err := os.WriteFile(fileName, []byte(data), 0644); err != nil {
		return errors.Wrapf(err, "write %v", fileName)
	}
	logger.Tf(ctx, "srt: wrote %v (enabled=%v)", fileName, cfg.Enabled)
	return nil
}

// restartSRS stops the SRS process; the container's bootstrap supervisor then
// brings the whole service back up, re-reading .srs.env. Deployments run with
// --restart always, so this is a brief (~10s) full restart.
func (v *SrtManager) restartSRS(ctx context.Context) error {
	pidFile := path.Join(conf.Pwd, "objs/srs.pid")
	b, err := os.ReadFile(pidFile)
	if err != nil {
		return errors.Wrapf(err, "read srs pid %v", pidFile)
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(b)))
	if err != nil {
		return errors.Wrapf(err, "parse srs pid %q", string(b))
	}
	logger.Wf(ctx, "srt: restarting SRS (pid=%v) to apply SRT encryption change", pid)
	if err := syscall.Kill(pid, syscall.SIGTERM); err != nil {
		return errors.Wrapf(err, "kill srs pid %v", pid)
	}
	return nil
}

func (v *SrtManager) Handle(ctx context.Context, handler *http.ServeMux) error {
	ep := "/terraform/v1/mgmt/srt/encryption"
	logger.Tf(ctx, "Handle %v", ep)
	handler.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		if err := func() error {
			var token, action string
			var enabled bool
			var passphrase, pbkeylen string
			if err := ParseBody(ctx, r.Body, &struct {
				Token      *string `json:"token"`
				Action     *string `json:"action"`
				Enabled    *bool   `json:"enabled"`
				Passphrase *string `json:"passphrase"`
				Pbkeylen   *string `json:"pbkeylen"`
			}{
				Token: &token, Action: &action, Enabled: &enabled,
				Passphrase: &passphrase, Pbkeylen: &pbkeylen,
			}); err != nil {
				return errors.Wrapf(err, "parse body")
			}

			apiSecret := envApiSecret()
			if err := Authenticate(ctx, apiSecret, token, r.Header); err != nil {
				return errors.Wrapf(err, "authenticate")
			}

			if action == "" {
				action = "query"
			}
			if action != "query" && action != "update" {
				return errors.Errorf("invalid action=%v", action)
			}

			if action == "query" {
				cfg, err := v.load(ctx)
				if err != nil {
					return err
				}
				ohttp.WriteData(ctx, w, r, &cfg)
				return nil
			}

			// action == "update"
			cfg := SrtEncryptConfig{Enabled: enabled, Pbkeylen: normalizePbkeylen(pbkeylen)}
			if enabled {
				passphrase = strings.TrimSpace(passphrase)
				if passphrase == "" {
					gen, err := generateSrtPassphrase()
					if err != nil {
						return err
					}
					passphrase = gen
				}
				if !srtPassphrasePattern.MatchString(passphrase) {
					return errors.Errorf("passphrase must be 10-79 letters and numbers")
				}
				cfg.Passphrase = passphrase
			}

			if err := v.save(ctx, cfg); err != nil {
				return err
			}
			if err := v.writeSrsEnv(ctx, cfg); err != nil {
				return err
			}

			// Respond before restarting so the client receives the new state,
			// then restart SRS (which restarts the whole container) shortly after.
			ohttp.WriteData(ctx, w, r, &struct {
				SrtEncryptConfig
				Restarting bool `json:"restarting"`
			}{SrtEncryptConfig: cfg, Restarting: true})
			logger.Tf(ctx, "srt: update ok, enabled=%v, token=%vB", cfg.Enabled, len(token))

			go func() {
				time.Sleep(1500 * time.Millisecond)
				if err := v.restartSRS(context.Background()); err != nil {
					logger.Wf(ctx, "srt: restart SRS failed: %v", err)
				}
			}()
			return nil
		}(); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	})
	return nil
}
