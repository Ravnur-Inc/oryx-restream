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

const (
	RoleOwner  = "owner"
	RoleEditor = "editor"

	// User lifecycle status. A user is "invited" until they sign in for the first
	// time, then "active". (Access itself is gated by the email allowlist + Entra.)
	StatusInvited = "invited"
	StatusActive  = "active"
)

var userManager *UserManager

// UserManager handles CRUD operations for simulcast users stored in Redis.
type UserManager struct{}

func NewUserManager() *UserManager {
	return &UserManager{}
}

// SimulcastUser represents a user of the simulcasting management application.
type SimulcastUser struct {
	ID        string `json:"id"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
	Role      string `json:"role"` // "owner" or "editor"
	CreatedAt string `json:"createdAt"`
	// Invite lifecycle.
	Status      string `json:"status,omitempty"`      // "invited" | "active"
	InvitedAt   string `json:"invitedAt,omitempty"`   // when the user was created/invited
	InvitedBy   string `json:"invitedBy,omitempty"`   // caller email that created the invite
	LastLoginAt string `json:"lastLoginAt,omitempty"` // last successful sign-in
}

func (v *SimulcastUser) String() string {
	return fmt.Sprintf("id=%v, email=%v, role=%v", v.ID, v.Email, v.Role)
}

func (v *UserManager) Handle(ctx context.Context, handler *http.ServeMux) error {
	ep := "/terraform/v1/mgmt/users"
	logger.Tf(ctx, "Handle %v", ep)
	handler.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		if err := func() error {
			var token, action, callerEmail string
			var invite bool
			var userReq SimulcastUser
			if err := ParseBody(ctx, r.Body, &struct {
				Token       *string `json:"token"`
				Action      *string `json:"action"`
				CallerEmail *string `json:"callerEmail"`
				Invite      *bool   `json:"invite"`
				*SimulcastUser
			}{
				Token: &token, Action: &action, CallerEmail: &callerEmail, Invite: &invite, SimulcastUser: &userReq,
			}); err != nil {
				return errors.Wrapf(err, "parse body")
			}

			apiSecret := envApiSecret()
			if err := Authenticate(ctx, apiSecret, token, r.Header); err != nil {
				return errors.Wrapf(err, "authenticate")
			}

			allowedActions := []string{"create", "update", "delete", "invite-resend", "invite-cancel"}
			if action != "" && !slicesContains(allowedActions, action) {
				return errors.Errorf("invalid action=%v", action)
			}

			// Role enforcement for mutating actions.
			// Bootstrap exception: if the user store is empty, the first create is allowed without a caller.
			if slicesContains(allowedActions, action) {
				count, err := rdb.HLen(ctx, SIMULCAST_USERS).Result()
				if err != nil && err != redis.Nil {
					return errors.Wrapf(err, "hlen %v", SIMULCAST_USERS)
				}
				// If callerEmail is provided (Entra flow), enforce owner role.
				// If empty, the caller authenticated via admin password (bearer token),
				// which already implies full access - no additional role check needed.
				if count > 0 && callerEmail != "" {
					callerRole, err := v.getUserRole(ctx, callerEmail)
					if err != nil {
						return errors.Wrapf(err, "get caller role for %v", callerEmail)
					}
					if callerRole != RoleOwner {
						return errors.Errorf("permission denied: %v has role %v, owner required", callerEmail, callerRole)
					}
				}
			}

			switch action {
			case "create":
				if err := validateUserFields(&userReq); err != nil {
					return err
				}
				userReq.Email = strings.ToLower(strings.TrimSpace(userReq.Email))
				if exists, err := v.emailExists(ctx, userReq.Email, ""); err != nil {
					return errors.Wrapf(err, "check email")
				} else if exists {
					return errors.Errorf("email %v is already in use", userReq.Email)
				}

				now := time.Now().Format(time.RFC3339)
				user := SimulcastUser{
					ID:        uuid.NewString(),
					FirstName: strings.TrimSpace(userReq.FirstName),
					LastName:  strings.TrimSpace(userReq.LastName),
					Email:     userReq.Email,
					Role:      userReq.Role,
					CreatedAt: now,
					// New users haven't signed in yet — "invited" until first sign-in.
					Status:    StatusInvited,
					InvitedAt: now,
					InvitedBy: callerEmail,
				}
				if err := v.persist(ctx, &user); err != nil {
					return errors.Wrapf(err, "persist user")
				}

				// Optionally email the invitation; on failure (or no SMTP) the UI
				// falls back to a copyable sign-in link.
				emailSent, emailErr := false, ""
				if invite {
					if err := sendInviteEmail(ctx, user.Email, strings.TrimSpace(user.FirstName+" "+user.LastName), callerEmail, user.Role); err != nil {
						emailErr = err.Error()
						logger.Wf(ctx, "invite email to %v failed: %v", user.Email, err)
					} else {
						emailSent = true
					}
				}

				ohttp.WriteData(ctx, w, r, &struct {
					*SimulcastUser
					EmailSent      bool   `json:"emailSent"`
					EmailError     string `json:"emailError,omitempty"`
					SmtpConfigured bool   `json:"smtpConfigured"`
				}{SimulcastUser: &user, EmailSent: emailSent, EmailError: emailErr, SmtpConfigured: smtpConfigured()})
				logger.Tf(ctx, "Users create ok, user=%v, invite=%v, emailSent=%v, token=%vB", user.String(), invite, emailSent, len(token))

			case "update":
				if userReq.ID == "" {
					return errors.New("id is required")
				}
				if err := validateUserFields(&userReq); err != nil {
					return err
				}
				userReq.Email = strings.ToLower(strings.TrimSpace(userReq.Email))

				raw, err := rdb.HGet(ctx, SIMULCAST_USERS, userReq.ID).Result()
				if err == redis.Nil {
					return errors.Errorf("user %v not found", userReq.ID)
				} else if err != nil {
					return errors.Wrapf(err, "hget %v %v", SIMULCAST_USERS, userReq.ID)
				}
				var current SimulcastUser
				if err := json.Unmarshal([]byte(raw), &current); err != nil {
					return errors.Wrapf(err, "unmarshal user")
				}

				if exists, err := v.emailExists(ctx, userReq.Email, userReq.ID); err != nil {
					return errors.Wrapf(err, "check email")
				} else if exists {
					return errors.Errorf("email %v is already in use", userReq.Email)
				}

				current.FirstName = strings.TrimSpace(userReq.FirstName)
				current.LastName = strings.TrimSpace(userReq.LastName)
				current.Email = userReq.Email
				current.Role = userReq.Role

				b, err := json.Marshal(&current)
				if err != nil {
					return errors.Wrapf(err, "marshal user")
				}
				if err := rdb.HSet(ctx, SIMULCAST_USERS, current.ID, string(b)).Err(); err != nil && err != redis.Nil {
					return errors.Wrapf(err, "hset %v %v", SIMULCAST_USERS, current.ID)
				}

				ohttp.WriteData(ctx, w, r, current)
				logger.Tf(ctx, "Users update ok, user=%v, token=%vB", current.String(), len(token))

			case "delete":
				if userReq.ID == "" {
					return errors.New("id is required")
				}
				raw, err := rdb.HGet(ctx, SIMULCAST_USERS, userReq.ID).Result()
				if err == redis.Nil {
					return errors.Errorf("user %v not found", userReq.ID)
				} else if err != nil {
					return errors.Wrapf(err, "hget %v %v", SIMULCAST_USERS, userReq.ID)
				}
				var target SimulcastUser
				if err := json.Unmarshal([]byte(raw), &target); err != nil {
					return errors.Wrapf(err, "unmarshal user")
				}
				if callerEmail != "" && strings.EqualFold(target.Email, callerEmail) {
					return errors.New("cannot delete your own account")
				}

				if err := rdb.HDel(ctx, SIMULCAST_USERS, userReq.ID).Err(); err != nil && err != redis.Nil {
					return errors.Wrapf(err, "hdel %v %v", SIMULCAST_USERS, userReq.ID)
				}

				ohttp.WriteData(ctx, w, r, nil)
				logger.Tf(ctx, "Users delete ok, id=%v, token=%vB", userReq.ID, len(token))

			case "invite-resend":
				if userReq.ID == "" {
					return errors.New("id is required")
				}
				target, err := v.getUser(ctx, userReq.ID)
				if err != nil {
					return err
				}
				emailSent, emailErr := false, ""
				if err := sendInviteEmail(ctx, target.Email, strings.TrimSpace(target.FirstName+" "+target.LastName), callerEmail, target.Role); err != nil {
					emailErr = err.Error()
					logger.Wf(ctx, "invite resend to %v failed: %v", target.Email, err)
				} else {
					emailSent = true
				}
				ohttp.WriteData(ctx, w, r, &struct {
					EmailSent      bool   `json:"emailSent"`
					EmailError     string `json:"emailError,omitempty"`
					SmtpConfigured bool   `json:"smtpConfigured"`
				}{EmailSent: emailSent, EmailError: emailErr, SmtpConfigured: smtpConfigured()})
				logger.Tf(ctx, "Users invite-resend, email=%v, emailSent=%v", target.Email, emailSent)

			case "invite-cancel":
				if userReq.ID == "" {
					return errors.New("id is required")
				}
				target, err := v.getUser(ctx, userReq.ID)
				if err != nil {
					return err
				}
				if target.Status == StatusActive {
					return errors.Errorf("%v has already accepted; use delete to remove an active user", target.Email)
				}
				if err := rdb.HDel(ctx, SIMULCAST_USERS, target.ID).Err(); err != nil && err != redis.Nil {
					return errors.Wrapf(err, "hdel %v %v", SIMULCAST_USERS, target.ID)
				}
				ohttp.WriteData(ctx, w, r, nil)
				logger.Tf(ctx, "Users invite-cancel ok, email=%v, token=%vB", target.Email, len(token))

			default: // list
				users, err := v.listUsers(ctx)
				if err != nil {
					return errors.Wrapf(err, "list users")
				}
				ohttp.WriteData(ctx, w, r, users)
				logger.Tf(ctx, "Users list ok, count=%v, token=%vB", len(users), len(token))
			}

			return nil
		}(); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	})

	return nil
}

func validateUserFields(u *SimulcastUser) error {
	if strings.TrimSpace(u.FirstName) == "" {
		return errors.New("firstName is required")
	}
	if strings.TrimSpace(u.LastName) == "" {
		return errors.New("lastName is required")
	}
	if strings.TrimSpace(u.Email) == "" {
		return errors.New("email is required")
	}
	if u.Role != RoleOwner && u.Role != RoleEditor {
		return errors.Errorf("role must be %q or %q", RoleOwner, RoleEditor)
	}
	return nil
}

func (v *UserManager) getUserRole(ctx context.Context, email string) (string, error) {
	all, err := rdb.HGetAll(ctx, SIMULCAST_USERS).Result()
	if err != nil && err != redis.Nil {
		return "", errors.Wrapf(err, "hgetall %v", SIMULCAST_USERS)
	}
	for _, raw := range all {
		var u SimulcastUser
		if err := json.Unmarshal([]byte(raw), &u); err != nil {
			continue
		}
		if strings.EqualFold(u.Email, email) {
			return u.Role, nil
		}
	}
	return "", errors.Errorf("user with email %v not found", email)
}

func (v *UserManager) emailExists(ctx context.Context, email, excludeID string) (bool, error) {
	all, err := rdb.HGetAll(ctx, SIMULCAST_USERS).Result()
	if err != nil && err != redis.Nil {
		return false, errors.Wrapf(err, "hgetall %v", SIMULCAST_USERS)
	}
	for _, raw := range all {
		var u SimulcastUser
		if err := json.Unmarshal([]byte(raw), &u); err != nil {
			continue
		}
		if strings.EqualFold(u.Email, email) && u.ID != excludeID {
			return true, nil
		}
	}
	return false, nil
}

// getUser fetches a single user by id, defaulting a missing status to active
// (back-compat for users created before the invite lifecycle existed).
func (v *UserManager) getUser(ctx context.Context, id string) (*SimulcastUser, error) {
	raw, err := rdb.HGet(ctx, SIMULCAST_USERS, id).Result()
	if err == redis.Nil {
		return nil, errors.Errorf("user %v not found", id)
	} else if err != nil {
		return nil, errors.Wrapf(err, "hget %v %v", SIMULCAST_USERS, id)
	}
	var u SimulcastUser
	if err := json.Unmarshal([]byte(raw), &u); err != nil {
		return nil, errors.Wrapf(err, "unmarshal user")
	}
	if u.Status == "" {
		u.Status = StatusActive
	}
	return &u, nil
}

// persist marshals and stores a user.
func (v *UserManager) persist(ctx context.Context, u *SimulcastUser) error {
	b, err := json.Marshal(u)
	if err != nil {
		return errors.Wrapf(err, "marshal user")
	}
	if err := rdb.HSet(ctx, SIMULCAST_USERS, u.ID, string(b)).Err(); err != nil && err != redis.Nil {
		return errors.Wrapf(err, "hset %v %v", SIMULCAST_USERS, u.ID)
	}
	return nil
}

func (v *UserManager) listUsers(ctx context.Context) ([]*SimulcastUser, error) {
	all, err := rdb.HGetAll(ctx, SIMULCAST_USERS).Result()
	if err != nil && err != redis.Nil {
		return nil, errors.Wrapf(err, "hgetall %v", SIMULCAST_USERS)
	}
	users := make([]*SimulcastUser, 0, len(all))
	for _, raw := range all {
		var u SimulcastUser
		if err := json.Unmarshal([]byte(raw), &u); err != nil {
			return nil, errors.Wrapf(err, "unmarshal user")
		}
		if u.Status == "" {
			u.Status = StatusActive // back-compat for pre-invite users
		}
		users = append(users, &u)
	}
	sort.Slice(users, func(i, j int) bool {
		return users[i].CreatedAt < users[j].CreatedAt
	})
	return users, nil
}

// bootstrapOwner provisions the given email as an owner. Used for first-run
// bootstrap (ENTRA_BOOTSTRAP_EMAIL) when no matching user exists yet. The display
// name is derived from the email's local part and can be edited later in the UI.
func (v *UserManager) bootstrapOwner(ctx context.Context, email string) (*SimulcastUser, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	local := email
	if i := strings.Index(email, "@"); i > 0 {
		local = email[:i]
	}
	now := time.Now().Format(time.RFC3339)
	user := &SimulcastUser{
		ID:          uuid.NewString(),
		FirstName:   local,
		LastName:    "(bootstrap admin)",
		Email:       email,
		Role:        RoleOwner,
		CreatedAt:   now,
		Status:      StatusActive, // created during their own first sign-in
		LastLoginAt: now,
	}
	b, err := json.Marshal(user)
	if err != nil {
		return nil, errors.Wrapf(err, "marshal user")
	}
	if err := rdb.HSet(ctx, SIMULCAST_USERS, user.ID, string(b)).Err(); err != nil && err != redis.Nil {
		return nil, errors.Wrapf(err, "hset %v %v", SIMULCAST_USERS, user.ID)
	}
	return user, nil
}
