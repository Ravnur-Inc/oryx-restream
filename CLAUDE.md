# CLAUDE.md — Oryx Fork (Ravnur Media Services)

## Purpose
This is a Ravnur fork of ossrs/oryx used exclusively as an
SRT → RTMP restreamer. It ingests SRT on port 10080/udp and
restreams RTMP to YouTube and Facebook via FFmpeg forward tasks.

## Working rules — READ BEFORE EVERY ACTION
1. Work on ONE feature group per session
2. After every file deletion run: go build ./...
3. If build breaks, fix ALL import errors before the next deletion
4. Never delete a file without first checking if its exported
   types/functions are referenced in files marked KEEP below
5. After all deletions in a session run: go mod tidy
6. Every session ends with a RAVNUR-CHANGES.md entry

## What we are keeping — do not touch without explicit instruction
- platform/forward.go (or equivalent) — restream task manager
- platform/srs-hooks.go — on_publish / on_unpublish callbacks
- platform/redis.go (or equivalent) — Redis client and state
- platform/api.go (or equivalent) — HTTP API server
- platform/nginx.go (or equivalent) — Nginx config management
- platform/auth.go (or equivalent) — mgmt password / token auth
- platform/main.go — entrypoint
- usr/lib/systemd/system/ — systemd units (hardening only)
- ui/ — React frontend (minimal changes only)

## What we are stripping (one session per group)
Session 1: scripts/nginx-hls-cdn/, focal/, aaPanel/BT references
Session 2: youtube-dl (scripts + any Go references)
Session 3: Let's Encrypt / LEGO (Go platform code)
Session 4: Tencent Cloud (tencentcloud-sdk-go, cos-go-sdk-v5)
Session 5: DVR / recording features
Session 6: Virtual live / vlive features
Session 7: OpenAI / AI transcription / AI Talk / OCR / Whisper

## Never
- Delete files that are shared between kept and stripped features
  without extracting the needed parts into a kept file first
- Modify go.sum manually — always use go mod tidy
- Remove types or interfaces used by the forward/restream manager
- Add new dependencies
- Touch the SRS binary or its config files
- Modify the Makefile without explicit instruction

## Compile verification command
cd platform && go build ./...

## After each session
git add -A
git commit -m "strip: remove <feature> [Ravnur]"