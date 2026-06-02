# Ravnur Fork Change Log

Upstream: https://github.com/ossrs/oryx  
Fork purpose: SRT → RTMP restreamer only  
Baseline tag: upstream-baseline-YYYYMMDD  
ISO 27001 evidence: This document satisfies Third-Party Component
Risk Assessment requirements for modified open-source software.

---

## Baseline
- Forked from ossrs/oryx main branch
- Upstream last release: v5.14.25 (July 10, 2024)
- All upstream code present; no modifications at baseline

---

## Changes

<!-- Sessions append entries here in the format below:

### YYYY-MM-DD — Strip: <feature name>
**Removed files:**
- platform/example.go — reason

**Removed Go dependencies (go.mod):**
- github.com/example/pkg — reason

**Retained from this feature area:**
- None / <description of any partial retention>

**Compile verification:** PASS — go build ./... clean
**Test verification:** PASS — go test ./... (N tests)

-->

### 2026-06-02 — Strip: nginx-hls-cdn, focal, aaPanel/BT shell references (Session 1)

**Removed directories/files (non-Go assets):**
- scripts/nginx-hls-cdn/ — standalone Nginx HLS edge-CDN Docker image; not used by the SRT→RTMP restreamer
- focal/ — Ubuntu Focal Docker build variant
- scripts/setup-aapanel/ — aaPanel control-panel plugin installer
- scripts/setup-bt/ — BaoTa (BT) control-panel plugin installer
- scripts/tools/bt_api_create_site.py, bt_api_remove_site.py, bt_api_setup_site.py, bt_tools.py — BT/aaPanel panel API helpers (only consumed by the removed installers)
- .github/workflows/focal.yml — CI workflow that built focal/Dockerfile
- .github/workflows/nginx-hls-cdn.yml — CI workflow that built scripts/nginx-hls-cdn/

**Edited to drop dangling references to the removed assets:**
- .github/workflows/release.yml — removed BT/aaPanel zip + asset-upload steps and release-note links; fixed example-var comment
- auto/pub.sh — removed setup-aapanel/setup-bt info.json version-bump blocks (VERSION1/VERSION2)
- scripts/tools/local-test-all.sh — removed aapanel/bt test targets; trimmed help/validation/CONTAINERS; fixed stray `bt` container ref in the kept `script` target
- scripts/tools/secret.sh — removed BT/aaPanel secret-retrieval branches
- .claudeignore — removed stale /scripts/nginx-hls-cdn/ entry

**Removed Go dependencies (go.mod):**
- None — this session removed only shell/Docker/CI assets; no Go code or imports changed

**Retained from this feature area:**
- platform/utils.go AAPANEL install-type enum and the BT/aaPanel SSL comment — runtime Go logic, a KEEP file, and out of scope for "shell references"
- DEVELOPER.md / README.md and UI references (TutorialsButton.js aaPanel link, locale.json HTTPS guidance) — left for a later docs/UI pass (ui/ is minimal-changes-only)

**Compile verification:** PASS — `cd platform && GOOS=linux go build ./...` clean (host Windows build fails only on pre-existing Linux-only syscall.Kill, unrelated to this session). No Go files were modified.
**go mod tidy:** Skipped intentionally — no Go dependencies changed this session.

### 2026-06-02 — Strip: AI features (Session 2)

**Removed Go source files:**
- platform/ai-talk.go — AI Talk conversational assistant (TalkServer, Stage, TTS/ASR/Chat services)
- platform/transcript.go — AI live transcription worker (TranscriptWorker + tasks/queues)
- platform/ocr.go — OCR worker over HLS (OCRWorker + tasks/queues)
- platform/dubbing.go — AI dubbing / VoD translation (SrsDubbingServer, projects, tasks)
- platform/openai.go — OpenAI model capability helpers (gptModelSupport*)
- platform/live-room.go — AI assistant "live room" (SrsLiveRoom, SrsAssistant config types) — only consumed by the AI files above

**Edited KEEP files to remove wiring to the deleted features:**
- platform/main.go — removed transcript/OCR/AI-Talk/AI-Dubbing worker creation + defer/Start blocks; removed containers/data/{transcript,ai-talk,dubbing,ocr} from the data-dir bootstrap
- platform/service.go — removed transcriptWorker.Handle / ocrWorker.Handle registrations and handleLiveRoomService / handleDubbingService / handleAITalkService route registrations
- platform/srs-hooks.go — removed the HLS-TS dispatch branches that fed transcriptWorker / ocrWorker (record/dvr/vod dispatch retained)

**Removed Go dependencies (go.mod, via go mod tidy + go mod vendor):**
- github.com/sashabaranov/go-openai — OpenAI client (ASR/chat/TTS/OCR/dubbing)
- github.com/go-audio/audio, github.com/go-audio/wav — WAV/audio processing for dubbing
- github.com/go-audio/riff (indirect) — pulled in by go-audio/wav
- Corresponding vendor/ trees removed (vendor/github.com/sashabaranov, vendor/github.com/go-audio)

**Retained / out of scope:**
- Shared HLS types SrsOnHlsMessage / SrsOnHlsObject / SrsStream live in utils.go (KEEP) — unaffected
- UI references to AI features (transcript/OCR/dubbing/AI-talk/live-room screens, locale strings) left for a later docs/UI pass (ui/ is minimal-changes-only)
- Tencent/cos deps remain (still used by srs-hooks.go + dvr-tencent-*.go) — Session 4

**Compile verification:** PASS — `GOOS=linux go build ./...` clean before and after `go mod tidy`/`go mod vendor`. No remaining references to AI symbols. (Native Windows build still fails only on the pre-existing Linux-only syscall.Kill.)
**Test verification:** Not run — code is Linux-only (syscall.Kill); cross-compiled tests build but cannot execute on the Windows dev host.

### 2026-06-02 — Strip: DVR local disk / record worker (Session 3)

**Removed Go source files:**
- platform/dvr-local-disk.go — local-disk recording worker (RecordWorker, recordWorker, RecordM3u8Stream, RecordPostProcess); records live streams to local .mp4/.ts files

**Edited KEEP files to remove wiring to the deleted feature:**
- platform/main.go — removed the RecordWorker creation + defer/Start block; removed the SRS_RECORD_M3U8_METADATA→SRS_RECORD_M3U8_ARTIFACT entry from the version-migration loop (DVR/VoD migration entries retained)
- platform/srs-hooks.go — removed the HLS-TS dispatch branch feeding recordWorker and the recordWorker.Handle registration (DVR/VoD dispatch + handlers retained)

**Removed Go dependencies (go.mod):**
- None — dvr-local-disk.go used only shared deps (go-redis, go-oryx-lib, stdlib); go.mod/go.sum unchanged

**Retained / out of scope:**
- Shared type M3u8VoDArtifact lives in utils.go (KEEP) — used by DVR/VoD; unaffected
- Redis key constants SRS_RECORD_PATTERNS / SRS_RECORD_M3U8_WORKING / SRS_RECORD_M3U8_ARTIFACT remain in utils.go (KEEP) — now unused (harmless dead constants; Go does not error on unused package-level consts). utils.go constant cleanup not in Session 3 scope; left for a later utils pass
- DvrWorker (dvr-tencent-cos.go) and VodWorker (dvr-tencent-vod.go) remain — they reference zero Record* symbols — Session 4
- UI references to the record feature left for a later docs/UI pass (ui/ is minimal-changes-only)

**Compile verification:** PASS — `GOOS=linux go build ./...` clean. The Tencent DVR/VoD files were verified to have no dependency on dvr-local-disk.go before removal.
**Test verification:** Not run — code is Linux-only (syscall.Kill); cross-compiled tests build but cannot execute on the Windows dev host.