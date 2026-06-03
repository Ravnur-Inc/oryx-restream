#!/usr/bin/env bash
#
# Copyright (c) 2022-2024 Winlin
#
# SPDX-License-Identifier: MIT
#
# One-shot deploy of the Ravnur Oryx SRT->RTMP restreamer onto a Linux VM
# (tested on Ubuntu 22.04 / 24.04 with Docker installed). Idempotent: re-run it
# to pull the latest main, rebuild, and recreate the container.
#
# Usage:
#   # from a fresh box (clones into ~/oryx-restream):
#   curl -fsSL https://raw.githubusercontent.com/Ravnur-Inc/oryx-restream/main/deploy/azure-vm/setup.sh | bash
#   # or, from inside an existing clone:
#   ./deploy/azure-vm/setup.sh
#
# Env overrides: REPO_URL, BRANCH, SRC_DIR, IMAGE, NAME, DATA_DIR
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Ravnur-Inc/oryx-restream.git}"
BRANCH="${BRANCH:-main}"
SRC_DIR="${SRC_DIR:-$HOME/oryx-restream}"
IMAGE="${IMAGE:-oryx-restream}"
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

# 1. Get the source: build in place if we're inside the repo, else clone/update.
if [ -f "./Dockerfile" ] && [ -d "./platform" ]; then
  SRC_DIR="$(pwd)"
  echo "==> Using current repo checkout: $SRC_DIR"
elif [ -d "$SRC_DIR/.git" ]; then
  echo "==> Updating existing clone: $SRC_DIR"
  git -C "$SRC_DIR" fetch origin "$BRANCH"
  git -C "$SRC_DIR" checkout "$BRANCH"
  git -C "$SRC_DIR" reset --hard "origin/$BRANCH"
else
  command -v git >/dev/null 2>&1 || { sudo apt-get update -y && sudo apt-get install -y git; }
  echo "==> Cloning $REPO_URL ($BRANCH) -> $SRC_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
fi
cd "$SRC_DIR"

# 2. Build the image, retrying transient Docker Hub pull timeouts.
echo "==> Building image: $IMAGE"
built=0
for attempt in 1 2 3; do
  if $DOCKER build -t "$IMAGE" -f Dockerfile .; then built=1; break; fi
  echo "    build attempt $attempt failed (often a transient Docker Hub pull timeout); retrying in 10s..."
  sleep 10
done
if [ "$built" != 1 ]; then
  echo "ERROR: build failed after 3 attempts." >&2
  exit 1
fi

# 3. (Re)create the container.
mkdir -p "$DATA_DIR"
$DOCKER rm -f "$NAME" >/dev/null 2>&1 || true
echo "==> Starting container: $NAME"
# Microsoft Entra ID sign-in (optional). Set both env vars before running to
# enable it; leave them unset to keep the password-only login. ENTRA_CLIENT_ID
# is the Azure app registration (client) ID; ENTRA_BOOTSTRAP_EMAIL is the email
# auto-provisioned as owner on its first sign-in (so the first login works).
$DOCKER run -d --name "$NAME" --restart always \
  -p 2022:2022 -p 2443:2443 -p 1935:1935 \
  -p 8000:8000/udp -p 10080:10080/udp \
  -e ENTRA_CLIENT_ID="${ENTRA_CLIENT_ID:-}" \
  -e ENTRA_BOOTSTRAP_EMAIL="${ENTRA_BOOTSTRAP_EMAIL:-}" \
  -v "$DATA_DIR:/data" \
  "$IMAGE"

# 4. Summary + next steps.
ip="$(curl -fsS --max-time 4 ifconfig.me 2>/dev/null || echo '<vm-public-ip>')"
echo
echo "================================================================"
$DOCKER ps --filter "name=$NAME"
echo "----------------------------------------------------------------"
echo "Mgmt UI:  https://${ip}:2443/mgmt   (accept the self-signed cert)"
echo "Logs:     ${DOCKER} logs -f ${NAME}"
echo "Data:     ${DATA_DIR}  (config/redis/password persist here)"
echo
echo "Open these INBOUND ports on the Azure NSG (see deploy/azure-vm/nsg-rules.sh):"
echo "  10080/udp  SRT ingest"
echo "  1935/tcp   RTMP ingest"
echo "  2443/tcp   mgmt UI (restrict to your IP)"
echo "  8000/udp   WebRTC preview (optional)"
echo "================================================================"
