// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"

	// From ossrs.
	"github.com/ossrs/go-oryx-lib/errors"
	"github.com/ossrs/go-oryx-lib/logger"
)

// smtpConfigured reports whether enough SMTP env is set to send mail.
func smtpConfigured() bool {
	return envSmtpHost() != "" && envSmtpFrom() != ""
}

// inviteSignInURL is the link placed in invite emails (and shown in the UI),
// derived from MGMT_BASE_URL. Empty if not configured.
func inviteSignInURL() string {
	return strings.TrimRight(envMgmtBaseURL(), "/")
}

// sendInviteEmail emails a sign-in invitation. Returns an error if SMTP isn't
// configured or the send fails; callers fall back to a copyable link in the UI.
func sendInviteEmail(ctx context.Context, toEmail, toName, inviterName, role string) error {
	if !smtpConfigured() {
		return errors.New("SMTP is not configured (set SMTP_HOST and SMTP_FROM)")
	}

	host := envSmtpHost()
	port := envSmtpPort()
	if port == "" {
		port = "587"
	}
	from := envSmtpFrom()
	addr := net.JoinHostPort(host, port)

	greeting := "Hello"
	if n := strings.TrimSpace(toName); n != "" {
		greeting = "Hello " + n
	}
	inviter := strings.TrimSpace(inviterName)
	if inviter == "" {
		inviter = "An administrator"
	}
	link := inviteSignInURL()

	var b strings.Builder
	b.WriteString(greeting + ",\r\n\r\n")
	b.WriteString(fmt.Sprintf("%s has invited you to the Ravnur Simulcast Manager as %s.\r\n\r\n", inviter, role))
	if link != "" {
		b.WriteString("Sign in with your Microsoft account here:\r\n")
		b.WriteString(link + "\r\n\r\n")
	} else {
		b.WriteString("Sign in with your Microsoft account at your organization's Simulcast Manager URL.\r\n\r\n")
	}
	b.WriteString("If you weren't expecting this invitation, you can safely ignore this email.\r\n")

	msg := buildEmailMessage(from, toEmail, "You've been invited to Ravnur Simulcast Manager", b.String())

	var auth smtp.Auth
	if u := envSmtpUser(); u != "" {
		auth = smtp.PlainAuth("", u, envSmtpPass(), host)
	}

	// Port 465 uses implicit TLS; 587/25 use STARTTLS (handled by smtp.SendMail).
	if port == "465" {
		if err := sendImplicitTLS(addr, host, auth, from, toEmail, msg); err != nil {
			return errors.Wrapf(err, "smtp(465) send to %v", toEmail)
		}
	} else if err := smtp.SendMail(addr, auth, from, []string{toEmail}, msg); err != nil {
		return errors.Wrapf(err, "smtp send to %v via %v", toEmail, addr)
	}

	logger.Tf(ctx, "invite email sent to %v via %v", toEmail, addr)
	return nil
}

func buildEmailMessage(from, to, subject, body string) []byte {
	headers := []string{
		"From: " + from,
		"To: " + to,
		"Subject: " + subject,
		"Date: " + time.Now().Format(time.RFC1123Z),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
	}
	return []byte(strings.Join(headers, "\r\n") + "\r\n\r\n" + body)
}

// sendImplicitTLS sends over an implicit-TLS connection (SMTPS, port 465).
func sendImplicitTLS(addr, host string, auth smtp.Auth, from, to string, msg []byte) error {
	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12})
	if err != nil {
		return errors.Wrapf(err, "tls dial %v", addr)
	}
	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return errors.Wrapf(err, "smtp client")
	}
	defer c.Close()
	if auth != nil {
		if err := c.Auth(auth); err != nil {
			return errors.Wrapf(err, "smtp auth")
		}
	}
	if err := c.Mail(from); err != nil {
		return errors.Wrapf(err, "smtp mail from")
	}
	if err := c.Rcpt(to); err != nil {
		return errors.Wrapf(err, "smtp rcpt to")
	}
	wc, err := c.Data()
	if err != nil {
		return errors.Wrapf(err, "smtp data")
	}
	if _, err := wc.Write(msg); err != nil {
		return errors.Wrapf(err, "smtp write")
	}
	if err := wc.Close(); err != nil {
		return errors.Wrapf(err, "smtp close data")
	}
	return c.Quit()
}
