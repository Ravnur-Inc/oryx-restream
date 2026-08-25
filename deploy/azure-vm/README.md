# Deploy the Oryx restreamer on an Azure Linux VM

This fork is a **SRT → RTMP restreamer**. It needs **UDP ingress** (SRT on
10080/udp) and arbitrary TCP ports, so it must run on a **VM** (or Azure
Container Instances) — **not** Azure App Service, which only accepts HTTP/HTTPS
on TCP 80/443 and cannot receive SRT.

## Prerequisites
- An Azure **Linux VM** (Ubuntu 22.04 or 24.04) with **Docker** installed.
- The VM's **Network Security Group** (see ports below).

## 1. Install / run on the VM
From a fresh box:
```bash
curl -fsSL https://raw.githubusercontent.com/Ravnur-Inc/oryx-restream/main/deploy/azure-vm/setup.sh | bash
```
or, if you've already cloned the repo:
```bash
./deploy/azure-vm/setup.sh
```
By default the script **pulls the published image** from GHCR
(`ghcr.io/ravnur-inc/oryx-restream:latest`) and (re)creates the `oryx` container
with the right port mappings and a persistent `~/oryx-data` volume. After each run
it **prunes unused images and build cache** so repeated upgrades don't fill the
disk. Re-run it any time to update to the latest published release.

Either way the script keeps a small repo clone at `~/oryx-restream` (it doesn't
build from it in pull mode), so the helper scripts (`nsg-rules.sh`,
`certbot-setup.sh`) are on the VM and you can re-run the installer from there:
`cd ~/oryx-restream && ./deploy/azure-vm/setup.sh`.

Options (env vars):

```bash
TAG=v3.5.2 ./deploy/azure-vm/setup.sh    # pin a specific version
BUILD=1   ./deploy/azure-vm/setup.sh     # build locally from this checkout instead of pulling
```

If the GHCR package is **private**, an anonymous pull fails and the script
**automatically falls back to a local build**. To pull instead, either
`docker login ghcr.io` (with a PAT that has `read:packages`) once, or make the
package public: GitHub org → **Packages → oryx-restream → Package settings →
Change visibility → Public**.

If you hit `permission denied … docker.sock`, add yourself to the docker group
once: `sudo usermod -aG docker $USER && newgrp docker` (or the script falls back
to `sudo docker`).

## 2. Open the firewall (NSG)
From a machine with the Azure CLI (`az login`) or Azure Cloud Shell:
```bash
RG=<resource-group> NSG=<nsg-name> MY_IP=<your-ip> ENCODER_IP=<encoder-ip> \
  ./deploy/azure-vm/nsg-rules.sh
```

| Port | Proto | Purpose | Source |
|------|-------|---------|--------|
| 10080 | UDP | SRT ingest | your encoder |
| 1935 | TCP | RTMP ingest | your encoder |
| 443 | TCP | mgmt UI / API (HTTPS) | your IP |
| 80 | TCP | Let's Encrypt HTTP-01 (cert issue/renew) | any |
| 8000 | UDP | WebRTC preview (optional) | your encoder |

SSH (22) is covered by Azure's default rules. Forwarding **out** to
YouTube/Facebook (443/1935) is outbound and allowed by default.

## 3. Use it
1. Open `https://<vm-ip>/mgmt` (accept the self-signed cert) and sign in — set the
   mgmt password on first run, or use Microsoft/Google SSO if configured (see
   **Authentication** below).
2. In **Destinations**, add your target(s) — YouTube/Facebook/Twitch/custom RTMP
   server + stream key (saved once, reusable across channels).
3. In **Channels**, create a channel, attach the destination(s), and copy its
   **ingest URL** (RTMP or SRT). Push a stream to it (OBS, or
   `ffmpeg -re -stream_loop -1 -i input.mp4 -c copy -f mpegts "<SRT-URL>"`);
   forwarding to every attached destination starts automatically.

## Recommended OBS / SRT settings
Proven-good publish settings for remote (internet) ingest:

- **OBS SRT URL** (Settings → Stream → Service: *Custom*, Server = this URL; the
  `streamid`/`secret` come from the mgmt UI):
  ```
  srt://<vm-ip>:10080?mode=caller&latency=1000&pkt_size=1316&rcvbuf=8388608&streamid=#!::r=live/<stream>?secret=<key>,m=publish
  ```
  - `latency=1000` (ms) + `rcvbuf=8388608` (8 MB) give SRT room to recover loss.
  - `pkt_size=1316` is the canonical SRT/MPEG-TS payload (avoids fragmentation).
  - `mode=caller` — OBS pushes to Oryx's listener.
- **Encoder:** H.264, **CBR**, **keyframe interval = 2s**. YouTube requires a
  keyframe at least every 4s or it sits on "Preparing stream"; B-frames are fine.
- The **server** already runs SRT in standard live mode in `srs.release.conf`
  (`tsbpdmode on; tlpktdrop on; latency 200`) so lossy SRT is reordered before
  the TS→RTMP transmux — without it you get macroblocking / overlapping frames.
  RTMP ingest needs none of this.

## Multiple restream destinations
In the mgmt UI → **Destinations**, add one entry per platform (YouTube, Facebook,
Twitch, or a custom RTMP URL) with that platform's RTMP server + stream key, then
attach them to a **Channel**. Oryx runs a separate FFmpeg forward task per
destination from the single ingest, so one inbound stream fans out to many
outputs. Forwarding is a remux (`-c copy`), so CPU stays low even with several
destinations.

## Run on boot
The container runs with `--restart always`, and `setup.sh` enables the Docker
service on boot, so Oryx comes back automatically after a VM reboot. Verify:
`sudo systemctl is-enabled docker` and, after a reboot, `docker ps`.

## SRT encryption (optional, AES)
By default SRT publishing is authorized by the stream key (`?secret=`) but the
media travels **unencrypted**. To require **AES encryption** on the SRT ingest
(common for contribution over the public internet):

**Easiest (no redeploy):** an owner can turn it on/off any time from the
management UI — **Ingest → SRT encryption**. Enabling auto-generates a passphrase
(editable, with a key-length choice); the change is saved to the persistent
volume and the **server restarts (~10–20s)** to apply it. This is the recommended
path when the person deploying doesn't know the encryption requirements up front.

**Or pre-seed at deploy time** with an env var before running `setup.sh` (the UI
toggle then reflects and can later override it):

```bash
export SRT_PASSPHRASE='a-strong-passphrase-10-to-79-chars'
export SRT_PBKEYLEN=16     # optional: 16=AES-128 (default), 24=AES-192, 32=AES-256
./deploy/azure-vm/setup.sh
```

- It's a **single passphrase for the whole SRT port** (listener-wide), combined
  with the per-stream `?secret=` for auth. Once set, **every** SRT publisher must
  use it; RTMP publishers are unaffected.
- The encoder enters it in its **Passphrase / SRT encryption** field — *not* the
  stream-key/stream-id field. The **Ingest** screen shows the passphrase and
  embeds it in the OBS SRT URL, and lists the decomposed fields (address / port /
  Stream ID / passphrase) for hardware encoders (Teradek, Haivision).
- Implemented via SRS's `SRS_SRT_SERVER_PASSPHRASE` / `SRS_SRT_SERVER_PBKEYLEN`
  env overrides — no config-file edit; unset = unencrypted (prior behavior). The
  UI toggle persists these to `containers/data/config/.srs.env` in the `/data`
  volume (so they survive restarts) and is the source of truth once used.
- Only the **ingest** leg is affected; the forward pipeline (local RTMP → FFmpeg
  → YouTube/Facebook) and HLS playback are unchanged.

## Invite emails (optional, SMTP)
The **Users** screen can email new users a Microsoft sign-in link. Configure SMTP
before running `setup.sh` (all optional — without them, invites still work and the
UI shows a copyable link to send manually):

```bash
export SMTP_HOST='smtp.sendgrid.net'      # or your relay / Microsoft 365 SMTP
export SMTP_PORT=587                       # 587 STARTTLS (default) or 465 (implicit TLS)
export SMTP_USER='apikey'                  # omit for relays without auth
export SMTP_PASS='********'
export SMTP_FROM='Ravnur Simulcast <no-reply@yourdomain.com>'
export MGMT_BASE_URL='https://restreamer.ravnur.net/mgmt'  # link put in the email
./deploy/azure-vm/setup.sh
```

- Only **invite emails** use SMTP; nothing else sends mail.
- `MGMT_BASE_URL` is the public URL of the mgmt UI; it's the sign-in link in the
  email. If unset, the email omits the link (the UI's copyable link still works).
- Implemented with Go's standard `net/smtp` (STARTTLS on 587, implicit TLS on
  465) — no extra dependencies.

## Monitoring
Two complementary layers:

**In-app (built in):** owners get a **System** tab — live host CPU load, memory,
disk, plus app signals (SRS up, FFmpeg forward count, goroutines/threads, uptime).
Good for an at-a-glance check; it has no history or alerting.

**Azure Monitor (recommended for alerts + history):** since this runs on an Azure
VM, the lowest-maintenance way to get CPU/memory/disk graphs *and* email alerts is
Azure Monitor — managed, nothing to run on the box.

1. **Enable VM insights** (installs the Azure Monitor Agent; collects CPU/memory/
   disk/network). Portal → the VM → *Monitoring → Insights → Enable*, or:
   ```bash
   az vm extension set -g <rg> --vm-name <vm> -n AzureMonitorLinuxAgent \
     --publisher Microsoft.Azure.Monitor
   ```
   (Linux memory/disk are *guest* metrics — VM insights / the agent provides them;
   CPU and VM availability are available without the agent.)
2. **Email action group:**
   ```bash
   az monitor action-group create -g <rg> -n oryx-alerts \
     --action email ops you@ravnur.com
   ```
3. **Alert rules** (tune thresholds):
   ```bash
   VM=$(az vm show -g <rg> -n <vm> --query id -o tsv)
   AG=$(az monitor action-group show -g <rg> -n oryx-alerts --query id -o tsv)
   az monitor metrics alert create -g <rg> -n oryx-cpu --scopes "$VM" --action "$AG" \
     --condition "avg Percentage CPU > 85" --window-size 5m --evaluation-frequency 1m
   az monitor metrics alert create -g <rg> -n oryx-mem --scopes "$VM" --action "$AG" \
     --condition "avg Available Memory Bytes < 209715200" --window-size 5m   # <200 MB free
   az monitor metrics alert create -g <rg> -n oryx-down --scopes "$VM" --action "$AG" \
     --condition "avg VM Availability Metric < 1" --window-size 5m            # VM unavailable
   ```
   For a **disk-full** alert (the top freeze-risk), add a rule on the guest
   "Logical Disk % Free Space" metric once VM insights is on, or watch it in the
   in-app System tab.

## Deploy configuration — `~/.oryx-env`
`setup.sh` sources `~/.oryx-env` (override with `ENV_FILE=`) on every run, and that
is where deploy settings belong. **Do not rely on `export` in your shell:** env
vars cannot be changed on a running container, so every run recreates it — and a
run from a shell that lacks the exports recreates it *without* them. Because the
mgmt UI is SSO-only, that silently produces a container nobody can log into.

```bash
cp deploy/azure-vm/oryx-env.example ~/.oryx-env
chmod 600 ~/.oryx-env      # contains secrets
$EDITOR ~/.oryx-env        # set ENTRA_CLIENT_ID + BOOTSTRAP_EMAIL
./deploy/azure-vm/setup.sh
```

`setup.sh` refuses to deploy when neither `ENTRA_CLIENT_ID` nor `GOOGLE_CLIENT_ID`
is set, rather than bringing up an unreachable UI. (`ALLOW_NO_SSO=1` overrides this
for an ingest-only box with no mgmt access.) Verify what the container actually got:

```bash
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' oryx | grep -E 'ENTRA|BOOTSTRAP|GOOGLE'
```

## Authentication — Microsoft Entra ID
The mgmt UI has **no password login** — Entra (and optionally Google) is the only
way in. To sign in with **Microsoft Entra ID** (Azure AD) and manage authorized
users with owner/editor roles, set these in `~/.oryx-env`:

```bash
ENTRA_CLIENT_ID=<your-app-registration-client-id>
BOOTSTRAP_EMAIL=<your-admin-email>
```

- **Azure app registration:** add a **Single-page application (SPA)** platform with
  the redirect URI matching your mgmt URL (e.g. `https://restreamer.ravnur.net`),
  and grant the `openid`, `profile`, `email` delegated permissions. The validator
  is multi-tenant (`/common`) and checks the token audience against `ENTRA_CLIENT_ID`.
- **The client ID must match the one the UI is built with** (`ui/src/msalInstance.js`).
  It is baked into the SPA bundle at build time, not served from `/envs`, so a
  server-side `ENTRA_CLIENT_ID` that differs (or is empty) fails every sign-in with
  a 500 — check `docker logs oryx | grep auth/entra` for the exact reason.
- **First-run bootstrap:** with an empty user store, the first Microsoft sign-in is
  auto-provisioned as an **owner only if the email equals `ENTRA_BOOTSTRAP_EMAIL`**
  (everyone else is rejected). Sign in once with that email, then add teammates in
  the **Users** screen. After bootstrap you can leave `ENTRA_BOOTSTRAP_EMAIL` set
  (it's a no-op once that user exists) or remove it.
- **Requires HTTPS** (Entra redirects to an https origin) — see the TLS section below.

## Authentication — Google (optional)
You can additionally (or instead) offer **Continue with Google**. Set a Google
OAuth client before running `setup.sh`:

```bash
# in ~/.oryx-env
GOOGLE_CLIENT_ID=<your-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-oauth-client-secret>
BOOTSTRAP_EMAIL=<your-admin-email>   # shared across providers
```

- **Google Cloud setup:** APIs & Services → Credentials → **Create OAuth client ID**
  → type **Web application**. Add your mgmt URL (e.g. `https://restreamer.ravnur.net`)
  under **Authorized JavaScript origins**. No redirect URI is needed — the app uses
  the popup `postmessage` auth-code flow. Copy the **Client ID** and **Client secret**.
- **How it works:** the SPA gets an authorization code in a popup; the server
  exchanges it with Google (using the secret) and reads the **verified** email from
  the returned ID token. The Google button appears only when `GOOGLE_CLIENT_ID` is set.
- **Authorization is by email**, shared with Entra — a user added in **Users** as
  `alice@corp.com` can sign in via Microsoft *or* Google with that address.
- **First-run bootstrap:** `BOOTSTRAP_EMAIL` (legacy `ENTRA_BOOTSTRAP_EMAIL` still
  works) is auto-provisioned as owner on its first sign-in via any provider.
- **Requires HTTPS** — see the TLS section below.

The management UI has a sidebar with **Channels** (routes: an ingest plus its
attached destinations, with start/stop and health badges), **Destinations** (the
reusable target library), **Ingest** (publish key + SRT-encryption toggle +
encoder reference), each channel's **Monitor** view (live preview + contribution/
egress health), and, for owners, **Users** (access + invites) and **System**
(host/app health).

## HTTPS / real TLS certificate for the mgmt UI
The mgmt UI uses a **self-signed** cert by default. For a trusted, **auto-renewing**
cert (recommended for anything long-lived):

```bash
DOMAIN=oryx.example.com EMAIL=you@example.com ./deploy/azure-vm/certbot-setup.sh
```
This installs **certbot**, obtains a Let's Encrypt cert, and writes a renewal
deploy-hook that drops the cert into Oryx's cert files
(`~/oryx-data/config/nginx.{key,crt}`). Oryx's kept cert-reload picks it up, and
certbot's systemd timer renews it twice-daily — **no manual re-upload, no
container restart** on renewal (live streams keep running). Requires a DNS name
pointing at the VM and **inbound TCP 80 open** on the NSG (HTTP-01 standalone is
used at issuance and each renewal). The app's built-in Let's Encrypt automation
was removed in this fork, so renewal is driven from the host this way.

Manual alternatives:
- Drop your own cert files into the persistent volume as
  `~/oryx-data/config/nginx.key` (private key) and `~/oryx-data/config/nginx.crt`
  (full-chain), then restart the container (`docker restart oryx`). You must
  replace them yourself before each expiry (~90 days for Let's Encrypt). The
  in-UI cert-upload screen was removed in this fork — use the file path or, better,
  the automated `certbot-setup.sh` above.
- Terminate TLS in front of the VM with **Azure Application Gateway** / a reverse
  proxy that forwards to the VM's `:443` (HTTPS) or `:2022` (HTTP).

## Notes
- Config, redis state, and the mgmt password persist in `~/oryx-data`.
- `docker logs -f oryx` to watch it; a healthy idle log shows SRS up and
  `forward start to run tasks`.
- Re-run `setup.sh` any time to pull the latest published image and recreate the
  container (it also prunes old images/cache). Use `TAG=vX.Y.Z` to pin a version
  or `BUILD=1` to build locally.

## Ongoing maintenance
`setup.sh` configures two things so a long-running deployment stays healthy with
little attention:
- **Docker log rotation** (`--log-opt max-size=10m --log-opt max-file=3`) so
  container logs can't fill the disk over time.
- **Unattended security upgrades** on the host (`unattended-upgrades`) so OS/Docker
  CVEs are patched even if the app is left untouched.

Still on you, periodically:
- **Back up `~/oryx-data`** (publish key, channels, destinations, users, TLS cert,
  redis state) — losing the VM loses all of it otherwise.
- **Verify cert auto-renewal**: `systemctl list-timers certbot.timer` (renews every
  ~90 days; needs port 80 reachable).
- **Security updates**: even with no feature changes, re-run `setup.sh` every few
  months to pull the latest published image (rebuilt in CI on a fresh base image +
  current FFmpeg), draining CVE drift on the public ingest ports.
- Watch disk/CPU/memory — see monitoring options if you want alerting.
