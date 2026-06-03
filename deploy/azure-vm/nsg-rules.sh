#!/usr/bin/env bash
#
# Copyright (c) 2022-2024 Winlin
#
# SPDX-License-Identifier: MIT
#
# Create the inbound Azure NSG rules the Oryx restreamer needs. Run from a
# machine with the Azure CLI logged in (`az login`) or in Azure Cloud Shell.
#
# Required env:
#   RG          resource group of the NSG
#   NSG         network security group name
# Optional env (default '*' = any source; tighten these for production):
#   MY_IP       your IP/CIDR for the mgmt UI (e.g. 203.0.113.4 or 203.0.113.0/24)
#   ENCODER_IP  the encoder's IP/CIDR allowed to publish SRT/RTMP
#
# Example:
#   RG=rg-oryx NSG=vm-oryx-nsg MY_IP=203.0.113.4 ENCODER_IP=198.51.100.7 ./nsg-rules.sh
set -euo pipefail

RG="${RG:?set RG to your resource group}"
NSG="${NSG:?set NSG to your network security group name}"
MY_IP="${MY_IP:-*}"
ENCODER_IP="${ENCODER_IP:-*}"

create() { # name priority protocol port source
  az network nsg rule create -g "$RG" --nsg-name "$NSG" -n "$1" \
    --priority "$2" --direction Inbound --access Allow \
    --protocol "$3" --destination-port-ranges "$4" \
    --source-address-prefixes "$5" --output none
  echo "  created $1 ($3/$4 from $5)"
}

echo "Adding NSG rules to $NSG (rg=$RG)..."
create Allow-SRT        1001 Udp 10080 "$ENCODER_IP"   # SRT ingest
create Allow-RTMP       1002 Tcp 1935  "$ENCODER_IP"   # RTMP ingest
create Allow-Mgmt-HTTPS 1003 Tcp 443   "$MY_IP"        # mgmt UI / API (HTTPS)
create Allow-WebRTC     1004 Udp 8000  "$ENCODER_IP"   # WebRTC preview (optional)
create Allow-HTTP       1005 Tcp 80     '*'            # Let's Encrypt HTTP-01 (certbot issue/renew)
echo "Done. (SSH/22 is allowed by the Azure default rules; outbound RTMP to"
echo "YouTube/Facebook on 443/1935 is allowed by default — no rule needed.)"
