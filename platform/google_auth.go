// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	jwt "github.com/golang-jwt/jwt/v4"
	"github.com/ossrs/go-oryx-lib/errors"
	ohttp "github.com/ossrs/go-oryx-lib/http"
	"github.com/ossrs/go-oryx-lib/logger"
)

var googleAuth *GoogleAuth

// GoogleAuth exchanges a Google OAuth authorization code (from the SPA's popup
// auth-code flow) for the user's verified email, then issues an Oryx session JWT
// — mirroring EntraAuth. Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
type GoogleAuth struct{}

func NewGoogleAuth() *GoogleAuth { return &GoogleAuth{} }

func (v *GoogleAuth) Handle(ctx context.Context, handler *http.ServeMux) error {
	ep := "/terraform/v1/mgmt/auth/google"
	logger.Tf(ctx, "Handle %v", ep)
	handler.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		if err := func() error {
			var code string
			if err := ParseBody(ctx, r.Body, &struct {
				Code *string `json:"code"`
			}{
				Code: &code,
			}); err != nil {
				return errors.Wrapf(err, "parse body")
			}
			if code == "" {
				return errors.New("code is required")
			}

			// Exchange the code for the user's verified email at Google.
			email, err := v.exchangeCodeForEmail(ctx, code)
			if err != nil {
				return errors.Wrapf(err, "exchange google code")
			}

			// Authorize the email against the user store and issue a session JWT
			// (shared with the other SSO providers — see auth_common.go).
			return authorizeAndIssueSession(ctx, w, r, email, "google")
		}(); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	})
	return nil
}

// exchangeCodeForEmail trades the authorization code for tokens at Google's token
// endpoint, then extracts the verified email from the returned ID token.
//
// The ID token is received directly from Google over TLS (server-to-server), so
// per Google's guidance its signature need not be re-verified here. We still
// validate issuer, audience, expiry, and email_verified as defense in depth.
func (v *GoogleAuth) exchangeCodeForEmail(ctx context.Context, code string) (string, error) {
	clientID := envGoogleClientID()
	clientSecret := envGoogleClientSecret()
	if clientID == "" || clientSecret == "" {
		return "", errors.New("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured")
	}

	form := url.Values{
		"code":          {code},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		// The SPA popup auth-code flow uses the special "postmessage" redirect URI.
		"redirect_uri": {"postmessage"},
		"grant_type":   {"authorization_code"},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://oauth2.googleapis.com/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", errors.Wrapf(err, "build token request")
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", errors.Wrapf(err, "post token endpoint")
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", errors.Wrapf(err, "read token response")
	}
	if resp.StatusCode != http.StatusOK {
		return "", errors.Errorf("google token endpoint status %v: %v", resp.StatusCode, string(body))
	}

	var tokenResp struct {
		IDToken string `json:"id_token"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", errors.Wrapf(err, "unmarshal token response")
	}
	if tokenResp.IDToken == "" {
		return "", errors.New("no id_token in google token response")
	}

	parsed, _, err := jwt.NewParser().ParseUnverified(tokenResp.IDToken, jwt.MapClaims{})
	if err != nil {
		return "", errors.Wrapf(err, "parse id_token")
	}
	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("invalid id_token claims")
	}

	// Audience must be our client ID.
	if !claims.VerifyAudience(clientID, true) {
		return "", errors.Errorf("invalid audience: %v", claims["aud"])
	}
	// Issuer must be Google.
	if iss, _ := claims["iss"].(string); iss != "https://accounts.google.com" && iss != "accounts.google.com" {
		return "", errors.Errorf("invalid issuer: %v", iss)
	}
	// Token must not be expired.
	if !claims.VerifyExpiresAt(time.Now().Unix(), true) {
		return "", errors.New("id_token is expired")
	}
	// Email must be present and verified.
	if verified, _ := claims["email_verified"].(bool); !verified {
		return "", errors.New("google account email is not verified")
	}
	email, _ := claims["email"].(string)
	if email == "" {
		return "", errors.New("no email claim in id_token")
	}

	return strings.ToLower(strings.TrimSpace(email)), nil
}
