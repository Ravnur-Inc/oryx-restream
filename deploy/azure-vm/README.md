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
The script clones (or updates) the repo, builds the Docker image (retrying
transient Docker Hub pull timeouts), and (re)creates the `oryx` container with
the right port mappings and a persistent `~/oryx-data` volume. Re-run it any
time to update to the latest `main`.

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
| 2443 | TCP | mgmt UI / API | your IP |
| 8000 | UDP | WebRTC preview (optional) | your encoder |

SSH (22) is covered by Azure's default rules. Forwarding **out** to
YouTube/Facebook (443/1935) is outbound and allowed by default.

## 3. Use it
1. Open `https://<vm-ip>:2443/mgmt` (accept the self-signed cert) and set the
   mgmt password.
2. In the **Scenario** tab, copy the **SRT publish URL** and push a stream
   (OBS, or `ffmpeg -re -stream_loop -1 -i input.mp4 -c copy -f mpegts "<SRT-URL>"`).
3. Add a **Forward** with your YouTube/Facebook RTMP server + stream key.

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
In the mgmt UI → **Scenario → Forward**, add one entry per platform (YouTube,
Facebook, Twitch, or a custom RTMP URL) with that platform's RTMP server +
stream key. Oryx runs a separate FFmpeg forward task per destination from the
single SRT ingest, so one inbound stream fans out to many outputs. Forwarding is
a remux (`-c copy`), so CPU stays low even with several destinations.

## Run on boot
The container runs with `--restart always`, and `setup.sh` enables the Docker
service on boot, so Oryx comes back automatically after a VM reboot. Verify:
`sudo systemctl is-enabled docker` and, after a reboot, `docker ps`.

## Authentication — Microsoft Entra ID (optional)
By default the mgmt UI uses a single password (`MGMT_PASSWORD`). To sign in with
**Microsoft Entra ID** (Azure AD) and manage authorized users with owner/editor
roles, set two env vars before running `setup.sh`:

```bash
export ENTRA_CLIENT_ID=<your-app-registration-client-id>
export ENTRA_BOOTSTRAP_EMAIL=<your-admin-email>
./deploy/azure-vm/setup.sh
```

- **Azure app registration:** add a **Single-page application (SPA)** platform with
  the redirect URI matching your mgmt URL (e.g. `https://restreamer.ravnur.net`),
  and grant the `openid`, `profile`, `email` delegated permissions. The validator
  is multi-tenant (`/common`) and checks the token audience against `ENTRA_CLIENT_ID`.
- **First-run bootstrap:** with an empty user store, the first Microsoft sign-in is
  auto-provisioned as an **owner only if the email equals `ENTRA_BOOTSTRAP_EMAIL`**
  (everyone else is rejected). Sign in once with that email, then add teammates in
  the **Users** screen. After bootstrap you can leave `ENTRA_BOOTSTRAP_EMAIL` set
  (it's a no-op once that user exists) or remove it.
- **Requires HTTPS** (Entra redirects to an https origin) — see the TLS section below.

The management UI itself now has **Forward** (card-based simulcast manager:
add/edit/delete destinations, custom keys, live stats), **Streams** (live
monitoring), and **Users** (owner-only), with the legacy SRT/transcode/system
screens kept under owner-only tabs.

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
- Paste a cert yourself in the mgmt UI → **Settings → HTTPS → SSL file** (private
  key + full-chain). Simple, but you must re-upload every ~90 days.
- Terminate TLS in front of the VM with **Azure Application Gateway** / a reverse
  proxy that forwards to `:2443` (or `:2022`).

## Notes
- Config, redis state, and the mgmt password persist in `~/oryx-data`.
- `docker logs -f oryx` to watch it; a healthy idle log shows SRS up and
  `forward start to run tasks`.
- Re-run `setup.sh` any time to pull the latest `main`, rebuild, and recreate
  the container.
