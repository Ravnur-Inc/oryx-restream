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

### 2026-06-02 — Strip: Tencent Cloud (DVR/COS, VoD, CAM) (Session 4)

**Removed Go source files:**
- platform/dvr-tencent-cos.go — DvrWorker: DVR live streams to Tencent COS (DvrWorker, dvrWorker, DvrM3u8Stream)
- platform/dvr-tencent-vod.go — VodWorker: live → Tencent VoD (VodWorker, vodWorker, VodM3u8Stream, VodCosToken)

**Edited KEEP files to remove Tencent branches + wiring:**
- platform/srs-hooks.go — removed the entire `/terraform/v1/tencent/cam/secret` HTTP handler (~390 lines of CAM/COS/VoD provisioning), the `/terraform/v1/tencent/versions` alias registration, the DVR/VoD HLS-TS dispatch branches, the dvrWorker/vodWorker `.Handle` registrations, and the now-unused tencentcloud (cam/common/profile/vod) + cos-go-sdk-v5 imports and stdlib imports (math/rand, net/url, strconv)
- platform/main.go — removed DvrWorker/VodWorker bootstrap; removed DVR/VoD version-migration loop; removed containers/data/{dvr,vod,srs-s3-bucket} from data-dir bootstrap and dvr/vod from the reset-dirs list
- platform/utils.go — removed orphaned redis-key constants (SRS_TENCENT_CAM/COS/VOD, SRS_DVR_*, SRS_VOD_*, SRS_VOD_COS_TOKEN) and the TENCENT_CLOUD_CAM/VOD_ENDPOINT consts. Also removed the now-orphaned SRS_RECORD_* constants left over from Session 3 (verified orphaned across the tree)

**Removed Go dependencies (go.mod, via go mod tidy + go mod vendor):**
- github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/{cam,common,vod}
- github.com/tencentyun/cos-go-sdk-v5
- Orphaned indirects auto-dropped: github.com/clbanning/mxj, github.com/google/go-querystring, github.com/mozillazg/go-httpheader, github.com/mitchellh/mapstructure
- Corresponding vendor/ trees removed. go.mod now only requires go-redis/redis (+xxhash, go-rendezvous indirect), golang-jwt, google/uuid, godotenv, go-oryx-lib

**Retained / out of scope (intentional):**
- SRS_TENCENT_LH constant + Tencent Lighthouse cloud/region auto-detection (metadata.tencentyun.com probes) in utils.go — still referenced by main.go/service.go for general cloud-environment detection (not DVR/VoD); removing it would expand scope into those KEEP files
- Shared type M3u8VoDArtifact + m3u8-builder helpers in utils.go — still used by callback.go (KEEP); left in place
- on_hls callback endpoint (handleOnHls) kept as a validating pass-through — SRS may still POST to it; it no longer dispatches anywhere
- containers/data/record dir + "record" reset-dir entry — Session 3 scope, left as-is

**Compile verification:** PASS — `GOOS=linux go build ./...` clean before and after `go mod tidy`/`go mod vendor`. Zero dangling references to dvrWorker/vodWorker/recordWorker or any removed Tencent constant. Vendor trees for tencentcloud/tencentyun/clbanning/mozillazg/mitchellh confirmed removed.
**Test verification:** Not run — code is Linux-only (syscall.Kill); cross-compiled tests build but cannot execute on the Windows dev host.

### 2026-06-02 — Strip: Virtual live + youtube-dl (Session 5)

**Removed Go source files:**
- platform/virtual-live-stream.go — virtual live worker (VLiveWorker, vLiveWorker, VLiveTask, VLiveConfigure); ingested a file/stream/youtube-dl source and republished it as a live stream. Contained the only `youtube-dl` invocation (exec.CommandContext "youtube-dl").

**Edited KEEP files to remove vLive + youtube-dl wiring:**
- platform/main.go — removed VLiveWorker bootstrap; removed envYtdlProxy() (and YTDL_PROXY=%v) from the startup env log; removed containers/data/vlive from data-dir bootstrap and "vlive" from the reset-dirs list
- platform/service.go — removed vLiveWorker.Handle registration
- platform/utils.go — removed envYtdlProxy() (YTDL_PROXY getter, youtube-dl only) and the dirVLivePath var (vlive-only, orphaned after file removal)

**Removed Go dependencies (go.mod):**
- None — youtube-dl is an external binary invoked via exec, not a Go module; virtual-live-stream.go used only shared deps. go.mod/go.sum unchanged.

**Retained / deferred (intentional):**
- The shared vLive+IP-camera limits API (handleMgmtEnvs vLiveLimit field, handleMgmtLimitsQuery/Update vlive entries) plus envVLiveLimit() and SrsSysLimitsVLive — co-owned with IP camera (Session 7). Deferred so both limit features are removed together rather than editing the UI-facing limits contract piecemeal. These compile fine without the worker.
- FFprobeSourceTypeYTDL enum member kept with the shared FFprobeSourceType enum (FFprobeSource/FFprobeSourceType are used by camera-live-stream.go) — harmless unused const; no source of that type can be created now
- dirDubbingPath var in utils.go — dead leftover from Session 2 (dubbing); unused package var, harmless; noted for a later utils pass
- UI references to vLive screens left for a later docs/UI pass (ui/ is minimal-changes-only)

**Compile verification:** PASS — `GOOS=linux go build ./...` clean. Zero dangling references to vLiveWorker/VLiveTask/envYtdlProxy/dirVLivePath/youtube-dl. No vendor changes.
**Test verification:** Not run — code is Linux-only (syscall.Kill); cross-compiled tests build but cannot execute on the Windows dev host.

### 2026-06-02 — Strip: LEGO / Let's Encrypt automation (Session 6)

Scope per plan: "binary exec removal only". LEGO is an external binary invoked
via exec("lego"), not a Go module. cert.go is NOT removed — CertManager also
provides self-signed and manually-uploaded SSL cert handling that the HTTPS API
server depends on. Only the Let's Encrypt/LEGO automation was excised.

**Edited platform/cert.go (KEEP file — surgical removal):**
- Removed updateLetsEncrypt() and renewLetsEncrypt() (the two exec("lego") call sites) and refreshSSLCert() (the periodic renewal driver that called renewLetsEncrypt)
- Removed now-unused imports "bytes" and "fmt" ("os/exec" retained — still used by updateSslFiles for rm)

**Edited other KEEP files to remove LEGO wiring:**
- platform/crontab.go — removed the 24h goroutine that called certManager.refreshSSLCert (the cert-file reload cron and certManager.Initialize retained)
- platform/service.go — removed the /terraform/v1/mgmt/letsencrypt handler (handleMgmtLetsEncrypt) and its registration
- platform/main.go — removed containers/data/lego from the data-dir bootstrap

**Removed Go dependencies (go.mod):**
- None — LEGO is an external binary (exec), not a Go module. go.mod/go.sum unchanged.

**Retained (HTTPS still works without Let's Encrypt):**
- CertManager + createSelfSignCertificate, updateSslFiles, QueryCertificate, ReloadCertificate, reloadCertificateFile, Initialize
- service.go handlers handleMgmtAutoSelfSignedCertificate, handleMgmtSsl (manual upload), handleMgmtCertQuery
- SRS_HTTPS / SRS_HTTPS_DOMAIN redis constants (still used by SSL handlers)
- containers/data/.well-known dir kept (ACME http-01 webroot; harmless empty dir, may be referenced by generated nginx config) — noted for a later nginx/UI pass
- UI Let's Encrypt screen + any nginx-config references left for a later docs/UI pass (ui/ is minimal-changes-only)

**Compile verification:** PASS — `GOOS=linux go build ./...` clean. Zero dangling references to lego/letsencrypt/refreshSSLCert. No vendor changes.
**Test verification:** Not run — code is Linux-only (syscall.Kill); cross-compiled tests build but cannot execute on the Windows dev host.

### 2026-06-02 — Strip: Cleanup — IP camera, version report, limits API (Session 7)

Per plan, each cleanup-candidate file was verified against forward.go and the
other KEEP files first. Two of the four candidates were KEPT because they are
core HTTP-service infrastructure, not standalone features:
- candidate.go — CandidateWorker.Resolve(host) is used by the WebRTC (WHIP/WHEP) proxy path in service.go to compute the eip param. RETAINED.
- fastcache.go — FastCache.HLSHighPerformance/HLSLowLatency drive HLS .m3u8 delivery caching in service.go and a crontab refresh. RETAINED.

**Removed Go source files:**
- platform/camera-live-stream.go — IP camera worker (CameraWorker, cameraWorker, CameraTask, CameraConfigure); ingested an IP camera source and republished it
- platform/report.go — queryLatestVersion (upgrade-check stub returning hardcoded version strings)

**Edited KEEP files:**
- platform/main.go — removed CameraWorker bootstrap; removed `go refreshLatestVersion(ctx)` and the refreshLatestVersion function; removed SRS_VLIVE_LIMIT/SRS_CAMERA_LIMIT setEnvDefaults and their startup env-log entries (SRS_FORWARD_LIMIT retained)
- platform/service.go — removed cameraWorker.Handle; removed vLiveLimit/cameraLimit from handleMgmtEnvs (forwardLimit retained); removed handleMgmtLimitsQuery + handleMgmtLimitsUpdate (the /terraform/v1/mgmt/limits/{query,update} endpoints, purely vLive+camera) and their registrations
- platform/crontab.go — removed the periodic queryLatestVersion goroutine (fastCache.Refresh and cert reload goroutines retained)
- platform/utils.go — NewConfig now seeds Versions from the `version` const (was "v0.0.0") so the status API still reports the app version without the upgrade poll; removed envVLiveLimit/envCameraLimit, SrsSysLimitsVLive/SrsSysLimitsCamera, SRS_SYS_LIMITS const, and the dead dirDubbingPath var (Session 2 leftover)

**Removed Go dependencies (go.mod):**
- None — all removed code used shared deps. go.mod/go.sum unchanged.

**Deferred / out of scope (noted for a follow-up pass):**
- OpenAI config endpoints handleMgmtOpenAIQuery/handleMgmtOpenAIUpdate + SRS_SYS_OPENAI const — AI-config leftovers from Session 2 (store/read OpenAI settings in redis; harmless without the AI workers). Left untouched to keep Session 7 scoped; flagged for a small follow-up cleanup.
- UI references to camera / vLive / limits screens and the mgmt/limits + version-check API contract — ui/ is minimal-changes-only; a dedicated UI/docs pass should remove the corresponding screens/strings.
- containers/data/.well-known dir (ACME webroot from the LEGO era) — still created; harmless.

**Compile verification:** PASS — `GOOS=linux go build ./...` clean at every stage. Zero dangling references to cameraWorker/queryLatestVersion/refreshLatestVersion/handleMgmtLimits/envVLiveLimit/envCameraLimit/SrsSysLimits/dirDubbingPath. candidate.go and fastcache.go confirmed retained. No vendor changes.
**Test verification:** Not run — code is Linux-only (syscall.Kill); cross-compiled tests build but cannot execute on the Windows dev host.

---

## Strip plan complete (Sessions 1–7)
All seven strip sessions are done. The platform now builds clean for linux with a
minimal dependency set (go-redis, golang-jwt, google/uuid, godotenv, go-oryx-lib +
xxhash/go-rendezvous indirect). Remaining platform/*.go: callback, candidate, cert,
crontab, fastcache, forward, main, service, srs-errors, srs-hooks, trancode, utils,
utils_test, version.

### 2026-06-02 — Follow-up cleanup (post Session 7)

Addresses the non-blocking Go follow-ups flagged after Session 7.

**OpenAI-config endpoint leftover (Session 2 remnant) — removed:**
- platform/service.go — removed handleMgmtOpenAIQuery + handleMgmtOpenAIUpdate (the /terraform/v1/mgmt/openai/{query,update} endpoints that stored/read OpenAI API key/url/org in redis) and their registrations
- platform/utils.go — removed the SRS_SYS_OPENAI redis-key const

**srs-errors.go — verified clean, no change:**
- The file defines a single error code, SrsStackErrorCallbackRecord (=100), which is still referenced by callback.go (a KEEP file, line 422). It is live, not dead, so srs-errors.go was left intact. No dead error codes to prune.

**Still deferred (intentional):**
- UI references to all stripped-feature screens + the removed mgmt API endpoints (openai/limits/letsencrypt/version) — ui/ is minimal-changes-only; a dedicated UI/docs pass should remove the corresponding screens and locale strings and align the API client.
- containers/data/.well-known dir (ACME webroot from the LEGO era) — still created; harmless.

**Removed Go dependencies (go.mod):** None — go.mod/go.sum unchanged.
**Compile verification:** PASS — `GOOS=linux go build ./...` clean. Zero dangling references to handleMgmtOpenAI/SRS_SYS_OPENAI. No vendor changes.
**Test verification:** Not run — code is Linux-only (syscall.Kill); cross-compiled tests build but cannot execute on the Windows dev host.