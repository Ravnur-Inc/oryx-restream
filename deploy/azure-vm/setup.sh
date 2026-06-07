#!/usr/bin/env bash
#
# Copyright (c) 2022-2024 Winlin
#
# SPDX-License-Identifier: MIT
#
# One-shot deploy of the Ravnur Oryx SRT->RTMP restreamer onto a Linux VM
# (tested on Ubuntu 22.04 / 24.04 with Docker installed). Idempotent: re-run it
# to pull the latest published image and recreate the container.
#
# By default it PULLS the published image from GHCR (fast, no local build churn)
# and prunes old images/cache afterwards. Set BUILD=1 to build locally from this
# checkout instead (also the automatic fallback if the pull fails, e.g. a private
# GHCR package — run `docker login ghcr.io` or make the package public to pull).
#
# Usage:
#   # fresh box, pull the published image (no clone needed):
#   curl -fsSL https://raw.githubusercontent.com/Ravnur-Inc/oryx-restream/main/deploy/azure-vm/setup.sh | bash
#   # pin a version:        TAG=v3.5.2 ./deploy/azure-vm/setup.sh
#   # build locally:        BUILD=1 ./deploy/azure-vm/setup.sh
#
# Env overrides: REPO_URL, BRANCH, SRC_DIR, IMAGE, TAG, BUILD, NAME, DATA_DIR
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Ravnur-Inc/oryx-restream.git}"
BRANCH="${BRANCH:-main}"
SRC_DIR="${SRC_DIR:-$HOME/oryx-restream}"
IMAGE="${IMAGE:-ghcr.io/ravnur-inc/oryx-restream}"  # published image repo to pull
TAG="${TAG:-latest}"                                # tag to pull (e.g. v3.5.2 to pin)
BUILD="${BUILD:-0}"                                 # set to 1 to build locally instead
LOCAL_IMAGE="oryx-restream:local"                   # tag used for local builds
NAME="${NAME:-oryx}"
DATA_DIR="${DATA_DIR:-$HOME/oryx-data}"

# Use sudo for docker only if the daemon isn't reachable as the current user.
DOCKER="docker"
if ! docker info >/dev/null 2>&1; then
  if sudo -n docker info >/dev/null 2>&1 || sudo docker info >/dev/null 2>&1; then
    DOCKER="sudo docker"
    echo "NOTE: using sudo for docker. To avoid this: sudo usermod -aG docker \$USER && newgrp docker"
  else
    echo "ERROR: Docker is not installed or not running." >&2
    exit 1
  fi
fi

# Ensure the Docker daemon starts on boot, so the container's --restart always
# brings Oryx back after a VM reboot.
sudo systemctl enable docker >/dev/null 2>&1 || true

# Enable unattended security updates on the host so OS/Docker CVEs are patched
# even if the app is left untouched. Best-effort (Debian/Ubuntu only).
if command -v apt-get >/dev/null 2>&1; then
  echo "==> Enabling unattended security upgrades"
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades >/dev/null 2>&1 || true
  printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' \
    | sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null || true
fi

# Get the source (clone/update) — only needed when building locally.
ensure_source() {
  if [ -f "./Dockerfile" ] && [ -d "./platform" ]; then
    SRC_DIR="$(pwd)"
    echo "==> Using current repo checkout: $SRC_DIR"
  elif [ -d "$SRC_DIR/.git" ]; then
    echo "==> Updating existing clone: $SRC_DIR"
    git -C "$SRC_DIR" fetch origin "$BRANCH"
    git -C "$SRC_DIR" checkout "$BRANCH"
    git -C "$SRC_DIR" reset --hard "origin/$BRANCH"
    cd "$SRC_DIR"
  else
    command -v git >/dev/null 2>&1 || { sudo apt-get update -y && sudo apt-get install -y git; }
    echo "==> Cloning $REPO_URL ($BRANCH) -> $SRC_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
    cd "$SRC_DIR"
  fi
}

# Build the image locally, retrying transient Docker Hub pull timeouts.
build_image() {
  ensure_source
  echo "==> Building image: $LOCAL_IMAGE"
  local attempt
  for attempt in 1 2 3; do
    if $DOCKER build -t "$LOCAL_IMAGE" -f Dockerfile .; then return 0; fi
    echo "    build attempt $attempt failed (often a transient Docker Hub pull timeout); retrying in 10s..."
    sleep 10
  done
  echo "ERROR: build failed after 3 attempts." >&2
  exit 1
}

# 1+2. Decide the image to run: pull the published image by default (fast, no
# local build churn), or build locally when BUILD=1 or the pull fails.
if [ "$BUILD" = "1" ]; then
  build_image
  RUN_IMAGE="$LOCAL_IMAGE"
else
  PULL_IMAGE="${IMAGE}:${TAG}"
  echo "==> Pulling published image: $PULL_IMAGE"
  if $DOCKER pull "$PULL_IMAGE"; then
    RUN_IMAGE="$PULL_IMAGE"
  else
    echo "    pull failed — the GHCR package may be private (run 'docker login ghcr.io'"
    echo "    or make it public), or the network is down. Falling back to a local build..."
    build_image
    RUN_IMAGE="$LOCAL_IMAGE"
  fi
fi

# 3. (Re)create the container.
mkdir -p "$DATA_DIR"
$DOCKER rm -f "$NAME" >/dev/null 2>&1 || true
echo "==> Starting container: $NAME"
# Microsoft Entra ID sign-in (optional). Set both env vars before running to
# enable it; leave them unset to keep the password-only login. ENTRA_CLIENT_ID
# is the Azure app registration (client) ID; BOOTSTRAP_EMAIL is the email
# auto-provisioned as owner on its first SSO sign-in, any provider (so the first
# login works). The legacy ENTRA_BOOTSTRAP_EMAIL still works as a fallback.
# Google sign-in (optional). Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (a
# Google Cloud "Web application" OAuth client) to show the Google button; unset
# hides it. The button appears only when GOOGLE_CLIENT_ID is configured.
sso_args=()
for v in BOOTSTRAP_EMAIL GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do
  if [ -n "${!v:-}" ]; then sso_args+=( -e "${v}=${!v}" ); fi
done
if [ -n "${GOOGLE_CLIENT_ID:-}" ]; then echo "    Google sign-in: ENABLED"; fi
# Optional SRT encryption (AES). Set SRT_PASSPHRASE (10-79 chars) to enable it;
# every SRT publisher must then use this passphrase. SRT_PBKEYLEN selects the AES
# strength (16=AES-128 default, 24, 32). Mapped to the env names SRS reads. Unset
# leaves SRT unencrypted (stream-key auth only).
srt_enc_args=()
if [ -n "${SRT_PASSPHRASE:-}" ]; then
  srt_enc_args+=( -e "SRS_SRT_SERVER_PASSPHRASE=${SRT_PASSPHRASE}" -e "SRS_SRT_SERVER_PBKEYLEN=${SRT_PBKEYLEN:-16}" )
  echo "    SRT encryption: ENABLED (AES, pbkeylen=${SRT_PBKEYLEN:-16})"
fi

# Optional email for user invites. Set SMTP_HOST + SMTP_FROM (and usually
# SMTP_PORT/USER/PASS) to email invites; MGMT_BASE_URL is the public mgmt URL put
# in the email's sign-in link. Unset = invites still work, but the UI shows a
# copyable link to send manually instead of emailing it.
smtp_args=()
for v in SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM MGMT_BASE_URL; do
  if [ -n "${!v:-}" ]; then smtp_args+=( -e "${v}=${!v}" ); fi
done
if [ -n "${SMTP_HOST:-}" ]; then echo "    Invite email (SMTP): ENABLED via ${SMTP_HOST}"; fi

# Mgmt UI HTTPS is published on host port 443 (-> container 2443) so it is
# reachable at https://<host>/mgmt with no port in the URL. This also makes the
# MSAL redirect origin match an app-registration redirect of https://<host>
# (no port). Port 80 is intentionally left unmapped for certbot HTTP-01 renewals.
$DOCKER run -d --name "$NAME" --restart always \
  --log-opt max-size=10m --log-opt max-file=3 \
  -p 2022:2022 -p 443:2443 -p 1935:1935 \
  -p 8000:8000/udp -p 10080:10080/udp \
  -e ENTRA_CLIENT_ID="${ENTRA_CLIENT_ID:-}" \
  -e ENTRA_BOOTSTRAP_EMAIL="${ENTRA_BOOTSTRAP_EMAIL:-}" \
  "${sso_args[@]}" \
  "${srt_enc_args[@]}" \
  "${smtp_args[@]}" \
  -v "$DATA_DIR:/data" \
  "$RUN_IMAGE"

# 4. Reclaim disk: drop images and build cache no longer used by any container.
# Repeated upgrades otherwise pile up old/dangling images + build cache (easily
# many GB). The running container's image is referenced, so it's kept.
echo "==> Pruning unused Docker images and build cache"
$DOCKER image prune -a -f >/dev/null 2>&1 || true
$DOCKER builder prune -f >/dev/null 2>&1 || true

# 5. Summary + next steps.
ip="$(curl -fsS --max-time 4 ifconfig.me 2>/dev/null || echo '<vm-public-ip>')"
echo
echo "================================================================"
$DOCKER ps --filter "name=$NAME"
echo "----------------------------------------------------------------"
echo "Mgmt UI:  https://${ip}/mgmt   (accept the self-signed cert)"
echo "Image:    ${RUN_IMAGE}"
echo "Logs:     ${DOCKER} logs -f ${NAME}"
echo "Data:     ${DATA_DIR}  (config/redis/password persist here)"
echo
echo "Open these INBOUND ports on the Azure NSG (see deploy/azure-vm/nsg-rules.sh):"
echo "  10080/udp  SRT ingest"
echo "  1935/tcp   RTMP ingest"
echo "  443/tcp    mgmt UI HTTPS (restrict to your IP)"
echo "  8000/udp   WebRTC preview (optional)"
echo "================================================================"
