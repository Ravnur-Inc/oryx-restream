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