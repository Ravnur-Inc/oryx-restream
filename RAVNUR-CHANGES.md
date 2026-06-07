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

### 2026-06-02 — Security: dependency vulnerability cleanup

Baseline: 147 open Dependabot alerts on the fork (4 critical / 70 high / 58 moderate / 15 low),
split as npm 130, pip 15, go 2.

**Cleared in this pass (17 alerts → go and pip now at zero):**
- Deleted scripts/tools/tencent-cloud/ (Tencent CVM provisioning python scripts; unreferenced, unrelated to the restreamer) → clears all 15 pip alerts (requirements.txt)
- Bumped github.com/golang-jwt/jwt/v4 v4.4.3 → v4.5.2 (go get + go mod tidy + go mod vendor) → clears both go alerts (1 high, 1 low). go build ./... clean.

**Remaining: 130 npm alerts, all in ui/package-lock.json (CRA / react-scripts 5.0.0 app).**
Breakdown: 46 are direct deps in package.json (axios 23, minimatch 10, http-proxy-middleware 3,
semver 3, moment 2, loader-utils 2, ejs/uuid/hermes-engine 1 each); 84 are transitive build-tooling
pulled by react-scripts. The bulk are build-time (webpack/dev-server/etc.) — not shipped in the
production browser bundle. Fully clearing them requires either npm overrides (fragile) or migrating
off the deprecated CRA toolchain (react-scripts) to Vite. This needs a node/npm environment (not
available on the current dev host) and is its own scoped effort in ui/ (minimal-changes zone),
overlapping the deferred UI feature-pruning. Tracked as a separate follow-up — see PR discussion.

### 2026-06-02 — UI/CI modernization + full vulnerability remediation (PRs #5–#12)

Completes the dependency/security work to **0 open Dependabot alerts (from 147) and `npm audit` = 0**.
Done as reviewed PRs, each gated on green CI (build + unit + EN/ZH docker integration tests).

**CI revival (PR #5).** The fork's CI was non-functional. Fixed a chain of retired dependencies:
- Runners: `ubuntu-20.04` (retired image, jobs queued forever) → `ubuntu-latest`.
- `actions/upload-artifact`/`download-artifact` v3 (GitHub auto-fails them) → v4.
- Dropped `python` from the repo CodeQL matrix (no Python remains after the strip).
- Added a jsdom `TextEncoder` polyfill (setupTests) and pruned the integration test suite of
  removed-feature tests (camera/liveroom/openai whole files; vLive/record/letsencrypt cases).

**npm Tier-1 remediation (PR #6): 130 → ~25 alerts.**
- `npm audit fix` (non-breaking) — clears axios (largest cluster) and many transitives.
- Bumped `react-qr-code` 2.0.3 → 2.0.21, which dropped its `react-native-svg → react-native@0.67`
  tree (~522 packages), eliminating both criticals (hermes-engine, react-native) and the metro/RN
  subtree. Removed unused cruft deps `hermes-engine` + `simple-plist`.

**UI feature-pruning (PR #7).** Removed 18 dead React files (screens/components) for stripped
features (AI talk/transcript/OCR/dubbing/live-room, DVR/record/VoD/COS, virtual-live, IP camera)
and the dead mgmt endpoints they called (openai/limits/letsencrypt). Kept the restreamer surface
(forward, transcode, live, SRT, manual SSL, callback, streams, auth, system). Inert i18n keys for
removed features left in ui/locale.json (0 refs, harmless).

**Toolchain + runtime modernization (PRs #8, #12): remaining alerts → 0.**
- Migrated ui/ from the deprecated/EOL Create-React-App (`react-scripts`) to **Vite 6 + Vitest 4**
  (removed ~1254 npm packages). New ui/vite.config.js (JSX-in-.js esbuild loader, PUBLIC_URL→base,
  BUILD_PATH→outDir, dev proxy ported from setupProxy, %PUBLIC_URL%/%REACT_APP_LOCALE% HTML tokens).
  Build/serve contract unchanged (build/{en,zh}; served by handleMgmtUI generically).
- **Node 18 (EOL 2025-04) → Node 22**: Dockerfile UI build stage `ossrs/node:18` → official
  `node:22` (`ossrs/node` has no :22 tag); CI `setup-node` v3→v4, node 18→22.
- Cleared the last advisories: `uuid` 8→11.1.1 (runtime), and `vite`/`vitest`/`esbuild` to patched
  versions (6.4.3 / 4.1.8 / 0.25.12) that resolve the Vite-toolchain dev-server advisories.

**Final state:** Dependabot **0** open alerts; `npm audit` **0**. No critical, no shipped-runtime,
no dev-tooling. go.mod minimal (go-redis, golang-jwt v4.5.2, google/uuid, godotenv, go-oryx-lib +
xxhash/go-rendezvous indirect). CI green end-to-end on `ubuntu-latest` + Node 22.

**Note (org-side, resolved):** the org-level "Code Quality" CodeQL workflow was reporting a
false-positive python failure on this repo (no Python after the strip); the org config was updated
to skip python.

**Verification:** All PRs merged on green CI (docker build + EN/ZH image + installer integration).
Native test execution remains Linux-only; the CI integration jobs are the authoritative run.
---

## 2026-06-03 — Container image publishing to GHCR (PR pending)

Added `.github/workflows/ghcr-publish.yml`: builds the image and pushes it to
**GitHub Container Registry** (`ghcr.io/ravnur-inc/oryx-restream`) on every `v*`
release tag (and on-demand via workflow_dispatch). Auth uses the built-in
`GITHUB_TOKEN` (`packages: write`) — no extra secrets. Tags: `{{version}}`,
`{{major}}.{{minor}}`, and `latest`. amd64-only (the image compiles SRS/Go/UI
from source; the deploy target is amd64 — arm64 can be added to `platforms`
later). Uses GitHub Actions layer cache (`type=gha`).

Neutralized the upstream ossrs release paths that fired on `v*` tags and would
fail/conflict for this fork:
- Deleted `.github/workflows/release.yml` (published to Docker Hub `ossrs/oryx`
  + Aliyun ACR, required `DOCKER_*`/`ACR_*` secrets, ossrs.io release notes).
- `.github/workflows/test-online.yml` → `workflow_dispatch` only (was `v*` tags);
  upstream online tests are not wired for this fork.

README Quick Start now leads with `docker run ghcr.io/ravnur-inc/oryx-restream:latest`.

NOTE: the first publish creates a **private** GHCR package; set it Public once in
the org Packages settings for anonymous `docker pull`.

---

## 2026-06-03 — Modern UI merge: Forward manager, Streams, Entra ID auth (PRs #24–#29)

Transplanted the modern management UI from the sibling fork (Ravnur Simulcast
Manager) onto this Vite-6 / zero-vuln base, plus the backend deltas it needs.
Six phases, each a branch + PR on green CI:

- **#24 forward API:** `delete` action on `/ffmpeg/forward/secret`; arbitrary
  custom platform keys via `isValidPlatformKey` (dropped the wx/bilibili/kuaishou
  allow-list + `forwarding-` rule); `ForwardTask.Stop()` disables the in-memory
  config to fix a restart-after-delete bug for enabled destinations.
- **#25 Forward UI:** `ForwardManager.js` (card UI, live stats, search/filter,
  add/edit/delete, custom keys + labels, unlimited destinations); Ravnur logo
  header; Public Sans; landing → Forward.
- **#26 Streams:** `Streams.js` live monitoring (UI-only; backend already had
  streams/query + kickoff + the `/api/` SRS proxy).
- **#27 Entra backend:** `entra_auth.go` (multi-tenant OIDC/JWKS validation,
  audience == `ENTRA_CLIENT_ID`) + `users.go` (owner/editor RBAC, `SIMULCAST_USERS`).
  No new Go deps (reuses golang-jwt/jwt/v4).
- **#28 Entra UI:** Microsoft sign-in (`Login.js`/`msalInstance.js`), `Users.js`
  admin, `RequireOwner` routing, `Forbidden`/`Logout`. New UI dep
  `@azure/msal-browser` (npm audit clean). Secure first-run bootstrap:
  `ENTRA_BOOTSTRAP_EMAIL` auto-provisions one owner on first sign-in.
- **#29 deploy/docs:** `setup.sh` passes `ENTRA_CLIENT_ID` + `ENTRA_BOOTSTRAP_EMAIL`;
  deploy guide + root README document the UI and Entra setup.

Note: `@azure/msal-browser` is a deliberate new dependency — the strip phase
(no-new-deps) is complete; the project is now in a feature-add phase.

---

## 2026-06-04 — Channels: saved, reusable ingests (PR pending)

Adds a Channel concept so operators can save a named ingest and reuse it across
repeat streams (keeping Forward source bindings stable and shared across the team,
not per-browser).

- platform/channels.go (new): ChannelManager + `/terraform/v1/mgmt/channels`
  (create/update/delete/list); Channel{id,name,label,description,createdAt};
  Redis hash `SRS_CHANNELS`; unique stream name, alnum/-/_ validation. Authed
  (any signed-in user); no SRS/forward changes.
- ui Channels screen (new, route /routers-channels, NavBar tab, all roles): CRUD
  cards showing each channel's ready-to-copy RTMP/SRT/HLS ingest URLs and the
  Forward destinations bound to it (matched by source stream name).
- ui/src/components/ingestUrls.js (new): shared URL builder; Ingest.js refactored
  to use it (one source of truth for the tuned SRT params + optional passphrase).

v1 scope: channels are saved ingest profiles + binding *visibility*. Deferred:
a channel directly owning/creating its Forward destinations (v2).

GOOS=linux go build ./... + vite build + 12 vitest pass.

---

## 2026-06-05 — Channels v2: route model (PR pending)

Makes a channel the operating unit, not just a saved ingest URL. UI-only (reuses
the existing forward + channels + streams APIs; no backend change).

- ui Channels screen rebuilt: each channel expands into a route — manage its
  Forward destinations inline (add/edit/delete/enable), with each destination
  auto-bound to the channel (source stream = channel name, custom platform key).
- Per-channel **Start all / Stop all**, live **source** status (from
  streams/query) and per-output live + FFmpeg stats (from forward/streams), 5s
  auto-refresh.
- Channel delete leaves its destinations intact (only removes the saved channel).
- Destinations created via a channel also appear in the Forward screen (same
  SRS_FORWARD_CONFIG); Forward stays the "all destinations" view, Channels the
  "by route" view.

vite build + 12 vitest pass.

---

## 2026-06-05 — Forward: unique destinations (Tier 1) (PR pending)

Prevents the same destination being configured twice and double-sent (e.g. a
standalone Forward YouTube + a channel YouTube on the same key both forwarding
the same stream → YouTube "more than one ingestion").

- platform/forward.go: the `update` action now rejects a destination whose
  (server + stream key) matches another existing config — normalized server
  (trailing slash/space trimmed). One destination target = one record.
- ui Channels "Add Destination": choose **Use existing** (reassign that
  destination's source to this channel — it moves; a destination is fed by one
  source at a time) or **Create new** (blocked if the target already exists).
  Reassign keeps the destination's platform key/server/secret/label.

Net: a given server+key can exist only once and be fed by one source, so two
concurrent streams to the same destination can't happen. Tier 2 (a first-class
reusable Destinations library) deferred.

GOOS=linux go build ./... + vite build + 12 vitest pass.

---

## 2026-06-05 — Destinations library (Tier 2) (PR pending)

A first-class, reusable library of forward targets that channels attach to.

- platform/destinations.go (new): DestinationManager + /terraform/v1/mgmt/destinations
  (create/update/delete/list); Destination{id,label,server,secret,createdAt};
  Redis hash SRS_DESTINATIONS; unique (server+key) within the library. Editing a
  destination **propagates** server/secret/label to the live forward config(s)
  that reference it and restarts their tasks. Delete is blocked while attached.
- platform/forward.go: ForwardConfigure gains `destinationId` linking a forward to
  a library entry (worker unchanged — server/secret stay embedded/live).
- ui Destinations screen (new, route /routers-destinations, NavBar tab, all roles):
  library CRUD + "attached to" status; delete blocked when attached.
- ui Channels "Add Destination" reworked: attach from the library (moves the
  destination here if attached elsewhere — one channel at a time) or create a new
  library entry and attach. Channel rows now Toggle + Detach (destination stays in
  the library); editing targets happens on the Destinations screen.

Single-active-feed is guaranteed by attach-as-move + the Tier-1 unique-target rule.
GOOS=linux go build ./... + vite build + 12 vitest pass.

---

## 2026-06-05 — Error UX: descriptive in-page messages (PR pending)

Replaces browser alert() popups and generic "status code 500" messages with
descriptive, in-page toasts across the modern UI.

Root cause: handlers raise plain Go errors, which go-oryx-lib serves via its
"unknown error" path as HTTP 500 with the message as a plain-text body. The UI
read e.response.data.message (undefined for a string body) and fell back to the
axios generic, shown via alert().

- ui/src/components/useToast.js (new): apiError(e) extracts the real message from
  any envelope (plain-text body, or {code,data} JSON); useToast() renders a
  dismissible, descriptive in-page toast (errors persist ~9s).
- Channels/Destinations/ForwardManager/Ingest/Streams/Users: every alert() and
  generic catch replaced with showError(e); load-error boxes use apiError(e).

Now e.g. attaching a destination that collides with an existing target shows
"a destination with this server and stream key already exists (…)" in-page,
instead of a browser popup saying "Request failed with status code 500".

vite build + 12 vitest pass.

---

## 2026-06-05 — Shared destinations with runtime exclusivity (PR pending)

A destination can now be attached to multiple channels (e.g. the city YouTube on
both "City Council Meetings" and "PAO"), with a runtime guarantee that only one
channel streams to it at a time — the second is blocked, not double-sent.

- forward.go: relaxed the config-time uniqueness rule — the same target
  (server+key) may be attached to different channels (different source stream);
  only an exact duplicate within the same channel is rejected. Added runtime
  target locking on the worker (activeTargets map + claimTarget/releaseTarget):
  doForward claims the target before starting FFmpeg; if another task owns it the
  task is marked blocked and retries until it frees up (auto-failover when the
  holder's source goes offline or is disabled). The /forward/streams response now
  returns a `blocked` flag.
- ui Channels: attach a destination to multiple channels (no longer "moves");
  destination rows show a BLOCKED badge when another channel holds the target.
  Destinations "attached to" lists all channels.

Scenario supported: shared YouTube across Council + PAO channels; whichever goes
live first owns YouTube, the other's YouTube output is blocked until it frees.
GOOS=linux go build ./... + vite build + 12 vitest pass.

---

## 2026-06-05 — User guide (PR pending)

Added docs/USER_GUIDE.md — an operator/user guide covering sign-in & roles,
concepts, a quick start, and every screen (Ingest, Destinations, Channels,
Streams, Forward, Users), plus common workflows (including shared destinations /
the BLOCKED rule), an encoder cheat-sheet, troubleshooting, and administration.
Linked from README; CLAUDE.md working rules now require updating the guide in the
same PR as any user-facing change.

---

## 2026-06-05 — Remove the Forward page (PR pending)

The Forward page overlapped with Channels + Destinations and let users create
forwards outside the library/channel model (orphans). Removed it; manage outputs
via Destinations (targets) + Channels (routes).

- ui: deleted pages/ForwardManager.js; removed the Forward nav tab from every
  screen and the /routers-forward route. Landing + RequireOwner + Login redirects
  + the Navigator logo now go to /routers-channels. Ingest cross-links point to
  Channels. Backend forward API is unchanged (still used by Channels/Destinations).
- docs: USER_GUIDE.md drops the Forward section and updates flow/roles/concepts;
  README updates the Management UI list and "configure a destination" steps to the
  Channels/Destinations flow.

vite build + 12 vitest pass.

---

## 2026-06-05 — Slim the Ingest page (PR pending)

The Ingest page's per-stream URL generation overlapped with Channels (each
channel already shows its ingest URLs). Slimmed Ingest to its unique value.

- ui/src/pages/Ingest.js: removed the stream-name input and the per-stream RTMP/
  SRT/HLS URL fields (and the buildIngestUrls/SrsEnvContext usage). Kept the
  shared **Publish key** (reveal / owner rotate), an **SRT encryption** section
  (passphrase when enabled), and the **encoder reference**. Title now "Publish
  settings"; points users to a Channel's Ingest URLs for the actual URL.
- buildIngestUrls/ingestUrls.js still used by Channels (unchanged).
- docs: USER_GUIDE.md Ingest section + quick start updated (URL comes from a
  Channel); README Management-UI bullet updated.

vite build + 12 vitest pass.

## 2026-06-05 — Streams: fitted player + list all defined streams (PR pending)

Two Streams-page fixes found during testing.

1. **Watch player was clipping.** The preview embedded SRS's bundled
   `player.html` in a fixed-height iframe, so the video rendered at native size
   and overflowed/cropped the box.
   - ui/src/components/FlvPlayer.js (new): a self-contained flv.js player in a
     responsive 16:9 container; video uses `object-fit: contain` so it fits the
     modal and letterboxes (never crops). Live tuning (no stash buffer, latency
     chasing); cleans up the player on close/unmount; in-player error message
     when the stream isn't publishing.
   - ui/src/pages/Streams.js PreviewModal now renders <FlvPlayer> (iframe +
     /tools/player.html removed); modal widened to 760px.
   - ui/package.json: add flv.js ^1.6.2 (npm audit: 0 vulnerabilities).

2. **Only active streams were listed.** Streams showed just current publishers
   (plus session history). Now it lists **every channel-defined stream**, idle
   until published, so operators see the full roster.
   - Streams.js StreamsImpl: fetch /terraform/v1/mgmt/channels alongside
     streams/query + /api/v1/streams; build one entry per channel (IDLE until a
     matching publisher appears → ACTIVE) plus any live publisher with no channel
     ("Unmanaged"). FPS delta moved to a ref so it survives the rebuilt list.
   - Status filter ACTIVE/IDLE (was ACTIVE/DISCONNECTED); Watch disabled while
     idle; card shows the channel's friendly label; stats bar STREAMS/ACTIVE/IDLE.
- docs: USER_GUIDE.md Streams section + README Management-UI bullet updated.

**CI trim (same PR):** .github/workflows/pullrequest.yml dropped the
`test-zh-image`, `test-zh-installer`, and `test-en-installer` jobs and removed
them from the `test-pr-final` gate. The ZH jobs only differed from EN by UI
locale (`REACT_APP_LOCALE=zh` / `--language zh`) and ran the identical backend
suite — pure duplication for this English-only fork. The installer jobs tested
the `scripts/setup-ubuntu` systemd host-install path, which this fork doesn't
ship (deployment is Docker via deploy/azure-vm). Kept **Test EN image** as the
end-to-end smoke test of the published container.

vite build + 12 vitest pass.

## 2026-06-05 — Health badges for streams and forward outputs (PR pending)

At-a-glance health for the contribution feed and each egress, derived purely
from signals already in the API (no backend change).

- ui/src/components/HealthBadge.js (new): pure derivation + a `<HealthBadge>`.
  - `parseFrameLog(log)` extracts fps / bitrate / **speed** from the FFmpeg
    progress line (speed was previously ignored).
  - `contributionHealth({active, fps})` → HEALTHY / STALLED (live but fps===0,
    a frozen feed) / IDLE.
  - `egressHealth({enabled, running, blocked, speed, sourceLive})` → BLOCKED /
    OFF / DOWN (source live but not forwarding) / WAITING (source not live yet) /
    DEGRADED (speed < 0.94× real time — falling behind) / HEALTHY.
  - Levels render with distinct colours (green/amber/red/orange/grey).
- ui/src/components/HealthBadge.test.js (new): 14 unit tests for the three
  pure functions (12 → 26 vitest total).
- Streams.js: each card's status pill is now a contribution HealthBadge.
- Channels.js: per-destination egress HealthBadge (replaces the LIVE/IDLE/BLOCKED
  span); the metrics pill now includes **speed**; the source shows a HealthBadge;
  the channel header flags "▲ N need attention" when outputs are degraded/down.
- docs: USER_GUIDE.md Channels + Streams sections; README Management-UI bullets.

vite build + 26 vitest pass.

## 2026-06-05 — Fix: stream health falsely STALLED + stray "0" badge (PR pending)

The Streams contribution badge flipped to STALLED after ~10s and a literal "0"
rendered next to the bitrate pill, even though the feed (and the player) was fine.

- Root causes: (1) `{fps && <badge>}` rendered the number 0 when the computed FPS
  was 0 (React renders falsy numbers); (2) `contributionHealth` keyed STALLED off
  that FPS, which is a frame-count delta that reads 0 whenever the SRS
  `/api/v1/streams` snapshot is momentarily stale — a false positive.
- Fix: `contributionHealth({active, bitrate})` now uses the 30s receive bitrate
  (robust data-flow signal); STALLED only when active and bitrate is exactly 0.
  FPS/bitrate badges guarded with `> 0` so a 0 never renders. Channels source
  badge call + HealthBadge.test.js updated accordingly.

vite build + 26 vitest pass.

## 2026-06-06 — Per-channel Monitor view (PR pending)

A dedicated single-channel monitoring page — "one pane of glass" for a broadcast.

- ui/src/pages/Monitor.js (new): route `routers-monitor/:name`. Live preview of
  the contribution feed (reuses FlvPlayer; idle placeholder when no publisher),
  contribution health (codec/res/audio/bitrate/uptime), and an Outputs list with
  each destination's egress HealthBadge + FPS/bitrate/speed. 5s refresh; reuses
  the HealthBadge derivations. Read-only (control stays on Channels).
- ui/src/App.js: import Monitor + register the route under :locale.
- ui/src/pages/Channels.js: each channel card gets a **Monitor** button that
  navigates to /<locale>/routers-monitor/<name> (useNavigate + Locale).
- Scope: single-channel only; a multiview wall is deferred.
- docs: USER_GUIDE.md new Monitor section + TOC + Channels mention (and the
  Streams health wording corrected to data-flow, matching the v2.10.1 fix);
  README Management-UI bullet.

vite build + 26 vitest pass.

## 2026-06-06 — Runtime SRT encryption toggle (Ingest page) (PR pending)

Customers reported that whoever deploys the restreamer often doesn't know the
users' encryption requirements, so SRT AES encryption needs to be switchable
post-deploy from the UI (previously it was deploy-time env only).

Mechanism (no SRS config-file surgery): the launcher `auto/start_srs` already
sources `containers/data/config/.srs.env` (in the persistent /data volume) and
exports it before starting SRS. The toggle writes that file and restarts SRS;
the container's `bootstrap` supervisor exits when SRS stops and Docker
(`--restart always`) brings the whole service back up with the new env.

- platform/srt.go (new): `SrtManager` + endpoint `/terraform/v1/mgmt/srt/encryption`
  (query/update). State in Redis (`SRS_SRT_ENCRYPT`), seeded from the deploy-time
  `SRS_SRT_SERVER_PASSPHRASE` env for back-compat. On enable: validate/auto-
  generate a 32-char alphanumeric passphrase (CSPRNG), normalize pbkeylen
  (16/24/32). Writes `.srs.env` (always both vars; empty when disabled so it
  overrides any inherited -e env), responds, then SIGTERMs SRS (pid file) to
  trigger the restart.
- platform/srs-hooks.go: `secretQueryHandler` now sources the SRT passphrase from
  SrtManager (so channels' SRT URLs reflect the toggle), falling back to env.
- platform/main.go + service.go: construct + register srtManager.
- ui/src/pages/Ingest.js: replaced the read-only SRT section with an owner toggle
  — auto-generated, editable passphrase (Regenerate), AES key-length choice, a
  restart warning + confirm, and an auto-reload once the server is back. Non-owners
  see status + passphrase read-only.
- docs: USER_GUIDE Ingest section, README bullets, deploy/azure-vm/README SRT
  section (UI toggle is now the easy path; env is a pre-seed).

GOOS=linux go build ./... + vite build + 26 vitest pass.

## 2026-06-06 — Remove non-restreaming pages (Scenario/System/Components/Contact) (PR pending)

These upstream-oryx owner-only screens aren't relevant to the restreamer, so they
were removed along with their nav tabs.

- ui/src/App.js: dropped the imports + routes for Scenario, Settings (System),
  Components, Contact (kept RequireOwner — Users is still owner-only).
- Removed the four owner-only entries from ALL_NAV_ITEMS in all six nav-bearing
  pages (Channels, Destinations, Ingest, Monitor, Streams, Users). Owner nav is
  now just **Users · Logout**; everyone sees Ingest · Channels · Destinations ·
  Streams.
- ui/src/pages/Setup.js: post-first-run redirect now goes to /routers-channels
  (was /routers-scenario).
- Deleted pages: Scenario.js (+ ScenarioForward/Live/Others/Srt/Transcode/
  Tutorials), Settings.js, Components.js, Contact.js. (Backend endpoints those
  screens called are left in place — harmless and out of scope.)
- docs: USER_GUIDE roles wording; README "publish secret" now points to
  Ingest → Publish key (was System → Auth).

vite build + 26 vitest pass (also drops the noisy ScenarioSrt esbuild warning).

## 2026-06-06 — Remove the Streams page; fold its unique bits into Channels/Monitor (PR pending)

With per-channel **Monitor** (live preview + contribution & egress health) and
Channels (overview + control + source health), the Streams page was almost
entirely redundant. Its only unique value was (1) **Reset** a stuck publisher and
(2) visibility of **unmanaged** (no-channel) live streams — both folded in.

- Deleted ui/src/pages/Streams.js + its route/import in App.js + the Streams nav
  entry from the remaining nav pages (Channels, Destinations, Ingest, Monitor,
  Users). Nav is now Ingest · Channels · Destinations (+ owner Users · Logout).
- Monitor.js: added a **Reset source** button (kickoff /terraform/v1/mgmt/streams/
  kickoff) shown when the source is live, with confirm — recovers a stuck feed.
- Channels.js: added an **unmanaged streams** notice — live publishers whose name
  matches no channel are listed with a "⚠ N unmanaged stream(s) publishing" banner.
- ui/src/pages/Ingest.js: "confirm live under Streams" hint now points to the
  channel's Monitor view.
- docs: USER_GUIDE removed the Streams section + TOC entry, folded Reset/unmanaged
  into Monitor/Channels, fixed flow/roles/quick-start wording; README dropped the
  Streams bullet and noted Reset + unmanaged on the Monitor/Channels bullets.

vite build + 26 vitest pass.

## 2026-06-06 — UI redesign: Mantine design system, responsive shell, dark/light (v3.0.0)

A full front-end redesign onto a real design system, replacing the per-page
hand-rolled chrome with a single responsive shell and theme tokens.

- **Stack:** React 17 → 18 (createRoot); added **Mantine v7** (@mantine/core,
  hooks, notifications) + @tabler/icons-react + postcss-preset-mantine. Brand
  color = Mantine **blue**; theme in `src/theme.js`.
- **Shell:** `components/AppLayout.js` — responsive Mantine AppShell with a
  sidebar (Ingest · Channels · Destinations · owner Users), a top bar (logo,
  page title, **light/dark toggle**, account menu + sign out), and an Outlet,
  wired as a react-router layout route. Color scheme follows the OS and persists;
  sidebar collapses to a drawer on small screens. App is wrapped in
  MantineProvider(defaultColorScheme="auto") + Notifications.
- **Tokens:** `components/tokens.js` + scheme-aware CSS variables in `index.css`
  (`--app-bg`/`--app-surface`/`--app-panel`) — one source of truth replacing the
  6 copy-pasted burnt-orange token sets; gives a tinted page + raised cards in
  both schemes (fixes the white-in-dark main panel + no-contrast-in-light bugs).
- **Pages:** removed the 5 duplicated per-page NavBars; migrated Ingest, Channels,
  Monitor, Destinations, Users and the auth pages (Login/Setup/Logout/Forbidden)
  to Mantine. Monitor's two-column layout stacks on phones. In-page toasts +
  SrsErrorBoundary fallback are theme-aware/provider-independent.
- **Bootstrap removed entirely** (bootstrap, react-bootstrap, react-bootstrap-icons)
  along with orphaned components (Footer, Navigator, LanguageSwitch, PopoverConfirm,
  SwitchConfirmButton, Tutorials*). react-error-boundary v3→v4
  (useErrorHandler → useErrorBoundary().showBoundary); @testing-library/* bumped
  to React-18 versions. **No legacy-peer-deps shim** — from-scratch install
  resolves clean; `npm audit` = 0.
- Dev: `DEV_PROXY_TARGET` env points the dev proxy at a live deployment; default
  dev locale is `en` (was `zh`). Standalone `design.html` styleguide retained.
- docs: USER_GUIDE "The interface" section + README updated.

GOOS=linux go build ./... (unchanged) · vite build + 26 vitest pass · npm audit 0.

## 2026-06-06 — Redesign fixes: Monitor crash, mobile layout, ESLint guard (v3.0.1)

- **Fix:** opening a channel **Monitor** threw `ReferenceError: CARD is not defined`
  — the migration imported a subset of tokens into Monitor.js but the page uses
  CARD. Added the missing import.
- **Guard:** added ESLint (flat config, `no-undef`) wired into the `test` script
  (`eslint src && vitest run`) so CI's "Run UTest" catches undefined identifiers
  — the exact class of bug the bundler doesn't flag. (`lint` stays an echo to
  preserve the Makefile's pre-install build ordering; `npm run eslint` for manual.)
- **Mobile breakpoint pass:** channel/destination/user **card headers** now stack
  (title over actions) below 600px via a shared `.card-header`/`.card-actions`
  class instead of squeezing the title to one word per line; per-destination rows
  group their metrics/badge/toggle/✕ controls so they wrap below the label;
  Monitor header + output rows wrap. (index.css + the page cards.)

vite build + eslint + 26 vitest pass.

## 2026-06-06 — User invites (email + status + resend/cancel)

Owners can invite users by email and track their status. Access is still gated by
the email allowlist + Entra; the invite adds the user and emails them a Microsoft
sign-in link.

Backend:
- platform/email.go (new): SMTP sender via Go stdlib net/smtp (STARTTLS on 587,
  implicit TLS on 465) — no new deps. Configured by SMTP_HOST/PORT/USER/PASS/FROM
  + MGMT_BASE_URL (link in the email). `smtpConfigured()` gates sending.
- users.go: SimulcastUser gains status (invited|active), invitedAt, invitedBy,
  lastLoginAt (missing status defaults to active for pre-existing users). `create`
  takes an `invite` flag and sets status=invited; new actions `invite-resend` and
  `invite-cancel` (cancel deletes a not-yet-active user). create/resend return
  {emailSent, smtpConfigured, emailError} so the UI can fall back to a link.
- entra_auth.go: first successful sign-in flips invited→active and records
  lastLoginAt (best-effort). bootstrapOwner is created active.
- utils.go: SMTP_* + MGMT_BASE_URL env helpers.

Frontend (Users):
- Add User has a "Send an invite email" checkbox; status badges (INVITED/ACTIVE);
  Resend / Cancel on invited users; last-sign-in date on active users; a PENDING
  stat. When email isn't sent (no SMTP or send failed), an **invite-link modal**
  shows a copyable sign-in link (origin + PUBLIC_URL).

Deploy/docs: setup.sh passes SMTP_*/MGMT_BASE_URL; deploy README "Invite emails"
section; USER_GUIDE Users section; README bullet.

GOOS=linux go build ./... + eslint + vite build + 26 vitest pass.

## 2026-06-06 — Update + make FFmpeg updatable

The base images (ossrs/srs:5 / ossrs/oryx:focal-1) bundle FFmpeg 5.0.2 (May 2022,
old). The platform invokes "ffmpeg" from PATH (forward.go / trancode.go), which
resolved to the base image's /usr/local/bin/ffmpeg.

- Dockerfile: install a current self-contained **static FFmpeg** in the build
  stage and copy ffmpeg + ffprobe into the runtime image at /usr/local/bin
  (overriding the base's 5.0.2); re-point SRS's objs/ffmpeg/bin/ffmpeg symlink at
  it. The static build has no runtime deps and is amd64 (matches the amd64-only
  image).
- **Updatable** via a new `FFMPEG_URL` build arg (default: latest stable static
  release), so each image build picks up the current FFmpeg; pin/override with
  `--build-arg FFMPEG_URL=...` (e.g. a versioned johnvansickle or BtbN build).
- README FFmpeg section updated (static build + how to update/pin/verify).

Verified by CI (Build platform image + Test EN image's publish->forward media
test, which exercises the new ffmpeg). Confirm the version with
`docker exec oryx ffmpeg -version`.

## 2026-06-06 — Deploy hardening for unattended long-running operation

Closes the two most likely "left alone for months" failure modes found while
reviewing maintenance:
- deploy/azure-vm/setup.sh: Docker **log rotation** on the container
  (`--log-opt max-size=10m --log-opt max-file=3`) — SRS logs to console → Docker
  json logs were unbounded and could fill the disk over time.
- setup.sh: install + enable **unattended-upgrades** on the host so OS/Docker CVEs
  are patched even if the app isn't touched (writes /etc/apt/apt.conf.d/20auto-upgrades).
- deploy README: "Ongoing maintenance" section (backups, cert-timer check,
  periodic security rebuild).

No app/code change; deploy-only.

## 2026-06-06 — In-app System health panel + Azure Monitor guidance

Owner-only health visibility, plus docs for proper VM monitoring.

- platform/system.go (new): `/terraform/v1/mgmt/system` returns host + app metrics
  read from /proc + syscalls (no deps): CPU load (vs cores), memory used/avail,
  disk usage for / and /data, goroutines, OS threads, platform RSS + Go heap, host
  + process uptime, SRS-reachable (pings :1985), and FFmpeg-forward count (scans
  /proc for `ffmpeg`). main.go/service.go register it.
- ui/src/pages/System.js (new): owner-only **System** tab (route routers-system,
  nav entry) — live gauges (amber/red thresholds) refreshing every 5s. Read-only.
- docs: deploy README "Monitoring" section (in-app panel + Azure Monitor enable +
  action group + CPU/memory/availability alert rules); USER_GUIDE System section.

GOOS=linux go build ./... + eslint + vite build + 26 vitest pass.

## 2026-06-07 — UI tweaks: sidebar order, header title, Microsoft logo on login

- AppLayout: sidebar order is now Channels · Destinations · Ingest (· Users ·
  System for owners); the header next to the logo shows the app name
  "Ravnur Simulcast Manager" instead of the current page label.
- Login: the Microsoft four-square logo (inline SVG) sits left of the
  "Sign in with Microsoft" label.

eslint + vite build + 26 vitest pass.

## 2026-06-07 — Operator guide → MkDocs Material site on GitHub Pages

The operator/user guide is now a published documentation site instead of a single
long Markdown file, and is linked from inside the app.

- docs-site/ (new): MkDocs Material source — 13 pages (Home, Getting started,
  Concepts, Channels, Destinations, Ingest, Monitor, Users & invites, System
  health, Encoder settings, Troubleshooting, Glossary, Administration) seeded from
  the former docs/USER_GUIDE.md, restructured per section. requirements.txt pins
  mkdocs-material.
- mkdocs.yml (new): site config (blue brand, light/dark palette, Public Sans,
  search, nav). site_url = https://ravnur-inc.github.io/oryx-restream/.
- .github/workflows/docs.yml (new): builds (`mkdocs build --strict`) and deploys
  to GitHub Pages on push to main (paths docs-site/mkdocs.yml/this workflow) or
  manual dispatch. One-time setup: repo Settings → Pages → Source = "GitHub
  Actions".
- ui/src/components/AppLayout.js: bottom-of-sidebar **Documentation** link
  (IconBook + external-link badge) opens the Pages site in a new tab.
- docs/USER_GUIDE.md: reduced to a pointer stub → the published site + how to edit
  docs-site/ locally. README + CLAUDE.md rule #7 updated to reference the site.

eslint + vite build + 26 vitest pass.
