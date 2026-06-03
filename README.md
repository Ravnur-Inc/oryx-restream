# oryx-restream

A purpose-built fork of [ossrs/oryx](https://github.com/ossrs/oryx) maintained by [Ravnur Inc](https://www.ravnur.com).

This fork strips Oryx down to a single function: ingest RTMP or SRT streams and restream them as RTMP to one or more destinations (YouTube, Facebook, or any RTMP endpoint).

---

## What This Is

**Ingest**
- RTMP on port `1935/tcp`
- SRT on port `10080/udp`

**Output**
- RTMP to any destination — YouTube Live, Facebook Live, or a custom RTMP URL
- Multiple simultaneous destinations supported

**Stack**
- [SRS](https://github.com/ossrs/srs) — media server handling RTMP/SRT ingest
- [FFmpeg](https://ffmpeg.org/) — restream task execution
- [Go](https://golang.org/) — platform backend and task orchestration
- [Redis](https://redis.io/) — stream key and task state
- [Nginx](https://nginx.org/) — reverse proxy for the management UI
- [React](https://react.dev/) — management UI

---

## What Was Removed

This fork removes everything not required for RTMP/SRT → RTMP restreaming:

- Tencent Cloud VoD / COS integration
- OpenAI / AI transcription / AI Talk / OCR
- DVR / local recording
- Virtual live (file-to-live broadcast)
- Let's Encrypt / LEGO *in-app* auto-HTTPS — replaced by host-level `certbot`
  auto-renewal (see the [deployment guide](./deploy/azure-vm/README.md#https--real-tls-certificate-for-the-mgmt-ui))
- youtube-dl
- aaPanel / BT panel integration
- HLS CDN scripts
- GB28181

See [RAVNUR-CHANGES.md](./RAVNUR-CHANGES.md) for the full change log with per-session detail.

---

## Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| `1935` | TCP | RTMP ingest |
| `10080` | UDP | SRT ingest |
| `2443` | TCP | Management UI (HTTPS) — restrict to trusted IPs |
| `2022` | TCP | Management UI (HTTP) — restrict to trusted IPs |
| `8000` | UDP | WebRTC preview (optional) |

Restrict the management UI ports (`2022`/`2443`) to trusted IP ranges at your
firewall or cloud NSG. `8000/udp` is only needed for the in-browser WebRTC
preview and can be closed if unused.

---

## Quick Start

No image is published to a registry yet — build and run from source. On a fresh
Linux VM (Ubuntu 22.04/24.04 with Docker), the one-shot script clones, builds,
and runs the container with the correct ports and a persistent volume:

```bash
curl -fsSL https://raw.githubusercontent.com/Ravnur-Inc/oryx-restream/main/deploy/azure-vm/setup.sh | bash
```

Or build and run it manually:

```bash
git clone https://github.com/Ravnur-Inc/oryx-restream.git
cd oryx-restream
docker build -t oryx-restream -f Dockerfile .
docker run -d --name oryx --restart always \
  -p 1935:1935 -p 10080:10080/udp \
  -p 2022:2022 -p 2443:2443 -p 8000:8000/udp \
  -v $HOME/oryx-data:/data \
  oryx-restream
```

Open `https://<vm-ip>:2443/mgmt` (accept the self-signed cert) and set the
management password on first run. For firewall/NSG rules, recommended OBS/SRT
settings, and auto-renewing TLS, see the
[deployment guide](./deploy/azure-vm/README.md).

### Publish a stream

The `<stream>` name and `<key>` (publish secret) come from the management UI.

**RTMP ingest:**
```
rtmp://<vm-ip>/live/<stream>?secret=<key>
```

**SRT ingest** (full URL with the recommended latency/buffer params — identical to
the [deployment guide](./deploy/azure-vm/README.md#recommended-obs--srt-settings)):
```
srt://<vm-ip>:10080?mode=caller&latency=1000&pkt_size=1316&rcvbuf=8388608&streamid=#!::r=live/<stream>?secret=<key>,m=publish
```

### Configure a restream destination

1. Open the management UI
2. Navigate to **Scenario → Forward**
3. Add a destination RTMP URL (e.g. `rtmp://a.rtmp.youtube.com/live2/<key>`) —
   add more than one for simultaneous restreaming to several platforms
4. Start publishing — the forward task fires automatically on ingest

---

## Deployment

For a complete production deployment — one-shot setup script, NSG/firewall
rules, recommended OBS/SRT encoder settings, SRT tuning for lossy ingest,
multiple restream destinations, and auto-renewing Let's Encrypt TLS — see
**[deploy/azure-vm/README.md](./deploy/azure-vm/README.md)**.

> Run it on a **VM** (or Azure Container Instances), **not** Azure App Service:
> SRT needs UDP ingress, which App Service does not provide.

---

## Building from Source

**Requirements**
- Go 1.21+
- Node.js 22+
- FFmpeg (system package recommended — see [Security](#security))

```bash
git clone https://github.com/Ravnur-Inc/oryx-restream.git
cd oryx-restream

# Build the Go platform backend (Linux-only — it uses syscall.Kill;
# on macOS/Windows cross-compile with GOOS=linux)
cd platform
go build ./...

# Build the React UI
cd ../ui
npm install
npm run build
```

---

## Security

### FFmpeg
The system FFmpeg package is recommended over any bundled binary — it receives OS-level security patches:

```bash
# Ubuntu 22.04 / 24.04
apt install ffmpeg
```

Verify the version in use:
```bash
ffmpeg -version
```

### Redis
Redis binds to `127.0.0.1` only and requires a password. These are enforced by the platform configuration. Do not expose Redis externally.

### SRT publish secret
Set a publish secret in the management UI under **System → Auth**. This prevents unauthorized sources from publishing to your ingest endpoint.

### Management UI
Restrict ports `2022`/`2443` to trusted IP ranges at your firewall or cloud NSG. Do not expose the management UI to the public internet.

### HTTPS / TLS
The management UI serves a **self-signed** certificate by default. For a trusted,
auto-renewing certificate, run [`deploy/azure-vm/certbot-setup.sh`](./deploy/azure-vm/certbot-setup.sh)
— host-level `certbot` plus Oryx's built-in cert hot-reload, so renewals apply
with zero downtime. Details in the
[deployment guide](./deploy/azure-vm/README.md#https--real-tls-certificate-for-the-mgmt-ui).

---

## Upstream

This fork tracks [ossrs/oryx](https://github.com/ossrs/oryx). The baseline commit is tagged `upstream-baseline-<date>` in this repository.

Security advisories and CVE remediations applied to this fork are documented in [RAVNUR-CHANGES.md](./RAVNUR-CHANGES.md).

---

## License

This fork is released under the [MIT License](./LICENSE), consistent with the upstream project.

Original copyright © ossrs contributors.  
Fork modifications copyright © Ravnur Inc.

---

## About Ravnur

[Ravnur](https://www.ravnur.com) builds video streaming and encoding infrastructure for enterprise customers on Azure.
