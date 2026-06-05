# CLAUDE.md — Oryx Fork (Ravnur Media Services)

## Purpose
This is a Ravnur fork of ossrs/oryx used exclusively as an
SRT → RTMP restreamer. It ingests SRT on port 10080/udp and
restreams RTMP to YouTube and Facebook via FFmpeg forward tasks.

## Phase status (2026-06-03)
The strip is **complete**. The project is now in a **feature-add phase**: a modern
management UI (Forward/Streams/Users) and Microsoft Entra ID auth were merged in
from the sibling fork. The strip-era "Never add new dependencies" rule no longer
applies as an absolute — deliberate, reviewed dependencies are allowed (e.g.
`@azure/msal-browser` for Entra). Keep deps minimal and vuln-free (npm audit / go
build clean) and prefer reusing what's already vendored.

## Working rules — READ BEFORE EVERY ACTION
1. Work on ONE feature group per session
2. After every file deletion run: go build ./...
3. If build breaks, fix ALL import errors before the next deletion
4. Never delete a file without first checking if its exported
   types/functions are referenced in files marked KEEP below
5. After all deletions in a session run: go mod tidy
6. Every session ends with a RAVNUR-CHANGES.md entry
7. Any user-facing change (UI screens, flows, encoder/ingest behavior) MUST
   update docs/USER_GUIDE.md in the same PR — it's the operator reference and
   must track the UI.

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

## Strip session order (revised per Session 0 audit)
Session 1: scripts/nginx-hls-cdn/, focal/, aaPanel/BT shell references
Session 2: AI features — ai-talk.go, transcript.go, ocr.go, dubbing.go,
           openai.go, live-room.go + go-openai, go-audio deps
Session 3: DVR local disk — dvr-local-disk.go
Session 4: Tencent Cloud — dvr-tencent-cos.go, dvr-tencent-vod.go,
           Tencent branches in srs-hooks.go, constants in utils.go,
           tencentcloud-sdk-go + cos-go-sdk-v5 from go.mod
Session 5: Virtual live + youtube-dl — virtual-live-stream.go
Session 6: LEGO / cert.go — binary exec removal only
Session 7: Cleanup — camera-live-stream.go, candidate.go,
           fastcache.go, report.go (verify each against forward.go first)

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