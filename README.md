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
- Let's Encrypt / LEGO auto-HTTPS
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
| `80` / `443` | TCP | Management UI (restrict to trusted IPs) |

Close `8000/udp` (WebRTC) — it is not used by this fork.

---

## Quick Start

```bash
docker run --restart always -d -it --name oryx-restream \
  -v $HOME/data:/data \
  -p 1935:1935 \
  -p 10080:10080/udp \
  -p 80:2022 \
  ravnur/oryx-restream:latest
```

Open `http://localhost` in your browser to access the management UI.

> **Note:** Set `MGMT_PASSWORD` on first run or configure it in `/data/config/.env`.

### Publish a stream

**RTMP ingest:**
```
rtmp://<host>/live/<stream-key>
```

**SRT ingest:**
```
srt://<host>:10080?streamid=live/<stream-key>
```

### Configure a restream destination

1. Open the management UI
2. Navigate to **Scenarios → Restream**
3. Add a destination RTMP URL (e.g. `rtmp://a.rtmp.youtube.com/live2/<key>`)
4. Start publishing — the forward task fires automatically on ingest

---

## Building from Source

**Requirements**
- Go 1.21+
- Node.js 18+
- FFmpeg (system package recommended — see [Security](#security))

```bash
git clone https://github.com/ravnur/oryx-restream.git
cd oryx-restream

# Build the Go platform backend
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
Restrict ports `80`/`443` to trusted IP ranges at your firewall or cloud NSG. Do not expose the management UI to the public internet.

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
