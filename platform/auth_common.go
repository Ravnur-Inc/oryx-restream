// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
package main

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/ossrs/go-oryx-lib/errors"
	ohttp "github.com/ossrs/go-oryx-lib/http"
	"github.com/ossrs/go-oryx-lib/logger"
)

// authorizeAndIssueSession is the identity-provider-agnostic tail of SSO sign-in.
// Given an email already extracted and verified by a provider (Entra, Google, …),
// it authorizes the user against the simulcast user store — or bootstraps the
// first owner — records the login, issues an Oryx-compatible session JWT, and
// writes the response. Shared by all SSO handlers so they behave identically;
// the provider name is used only for logging.
func authorizeAndIssueSession(ctx context.Context, w http.ResponseWriter, r *http.Request, email, provider string) error {
	// Check that the email exists in the simulcast user store.
	users, err := userManager.listUsers(ctx)
	if err != nil {
		return errors.Wrapf(err, "list users")
	}
	var matched *SimulcastUser
	for _, u := range users {
		if strings.EqualFold(u.Email, email) {
			matched = u
			break
		}
	}
	if matched == nil {
		// First-run bootstrap: auto-provision the single configured admin email as
		// an owner so a freshly deployed instance (empty user store) is usable
		// without a separate seeding step. Only the exact BOOTSTRAP_EMAIL
		// qualifies; everyone else is rejected.
		bootstrap := strings.ToLower(strings.TrimSpace(envBootstrapEmail()))
		if bootstrap != "" && bootstrap == email {
			created, err := userManager.bootstrapOwner(ctx, email)
			if err != nil {
				return errors.Wrapf(err, "bootstrap owner %v", email)
			}
			matched = created
			logger.Tf(ctx, "%v bootstrap: provisioned owner %v", provider, email)
		} else {
			return errors.Errorf("user %v is not authorized to access this application", email)
		}
	} else {
		// Existing user signed in: mark active (accepts a pending invite) and record
		// the login time. Best-effort — don't fail sign-in on a write error.
		now := time.Now().Format(time.RFC3339)
		if matched.Status != StatusActive || matched.LastLoginAt == "" {
			matched.Status = StatusActive
		}
		matched.LastLoginAt = now
		if err := userManager.persist(ctx, matched); err != nil {
			logger.Wf(ctx, "%v: update login state for %v failed: %v", provider, email, err)
		}
	}

	// Issue an Oryx-compatible session JWT so all existing API calls work unchanged.
	apiSecret := envApiSecret()
	expireAt, createAt, token, err := createToken(ctx, apiSecret)
	if err != nil {
		return errors.Wrapf(err, "create session token")
	}

	ohttp.WriteData(ctx, w, r, &struct {
		Token    string         `json:"token"`
		CreateAt string         `json:"createAt"`
		ExpireAt string         `json:"expireAt"`
		Bearer   string         `json:"bearer"`
		User     *SimulcastUser `json:"user"`
	}{
		Token:    token,
		CreateAt: createAt.Format(time.RFC3339),
		ExpireAt: expireAt.Format(time.RFC3339),
		Bearer:   apiSecret,
		User:     matched,
	})
	logger.Tf(ctx, "%v auth ok, email=%v, role=%v", provider, email, matched.Role)
	return nil
}
