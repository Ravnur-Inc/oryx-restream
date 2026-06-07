# Administration

*Owner / operator tasks. See the
[deployment guide](https://github.com/Ravnur-Inc/oryx-restream/blob/main/deploy/azure-vm/README.md)
for full setup, hardening, and upgrades.*

- **Install / upgrade** — `deploy/azure-vm/setup.sh` (clone/build/run); pull the
  latest and re-run to upgrade.
- **HTTPS / TLS** — auto-renewing Let's Encrypt via
  [`certbot-setup.sh`](https://github.com/Ravnur-Inc/oryx-restream/blob/main/deploy/azure-vm/README.md#https--real-tls-certificate-for-the-mgmt-ui).
- **Microsoft Entra sign-in** — set `ENTRA_CLIENT_ID` (+ `BOOTSTRAP_EMAIL`
  for the first owner) before running setup; add the SPA redirect URI in the Azure
  app registration. See
  [Authentication](https://github.com/Ravnur-Inc/oryx-restream/blob/main/deploy/azure-vm/README.md#authentication--microsoft-entra-id-optional).
- **Google sign-in** — set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (a Google
  Cloud "Web application" OAuth client) before running setup; add your mgmt URL as
  an authorized JavaScript origin. The button appears only when configured;
  authorization is by email, shared with Entra. See
  [Authentication — Google](https://github.com/Ravnur-Inc/oryx-restream/blob/main/deploy/azure-vm/README.md#authentication--google-optional).
- **Invite emails (SMTP)** — set `SMTP_*` + `MGMT_BASE_URL` to email user invites;
  without them the UI shows a copyable link. See
  [Invite emails](https://github.com/Ravnur-Inc/oryx-restream/blob/main/deploy/azure-vm/README.md#invite-emails-optional-smtp).
- **SRT encryption** — toggle it in **Ingest** (owner), or pre-seed
  `SRT_PASSPHRASE` / `SRT_PBKEYLEN` at deploy time.
- **Monitoring** — the in-app **[System](system.md)** tab for at-a-glance health;
  **Azure Monitor** for history + alerting.
- **Ongoing maintenance** — back up `~/oryx-data`; verify the certbot renewal
  timer; rebuild periodically to pick up base-image + FFmpeg security updates. See
  [Ongoing maintenance](https://github.com/Ravnur-Inc/oryx-restream/blob/main/deploy/azure-vm/README.md#ongoing-maintenance).
- **Container image** — `ghcr.io/ravnur-inc/oryx-restream` (versioned tags).
