# Deploy the Oryx restreamer on an Azure Linux VM

This fork is a **SRT → RTMP restreamer**. It needs **UDP ingress** (SRT on
10080/udp) and arbitrary TCP ports, so it must run on a **VM** (or Azure
Container Instances) — **not** Azure App Service, which only accepts HTTP/HTTPS
on TCP 80/443 and cannot receive SRT.

## Prerequisites
- An Azure **Linux VM** (Ubuntu 22.04 or 24.04) with **Docker** installed.
- The VM's **Network Security Group** (see ports below).

## 1. Install / run on the VM
From a fresh box:
```bash
curl -fsSL https://raw.githubusercontent.com/Ravnur-Inc/oryx-restream/main/deploy/azure-vm/setup.sh | bash
```
or, if you've already cloned the repo:
```bash
./deploy/azure-vm/setup.sh
```
The script clones (or updates) the repo, builds the Docker image (retrying
transient Docker Hub pull timeouts), and (re)creates the `oryx` container with
the right port mappings and a persistent `~/oryx-data` volume. Re-run it any
time to update to the latest `main`.

If you hit `permission denied … docker.sock`, add yourself to the docker group
once: `sudo usermod -aG docker $USER && newgrp docker` (or the script falls back
to `sudo docker`).

## 2. Open the firewall (NSG)
From a machine with the Azure CLI (`az login`) or Azure Cloud Shell:
```bash
RG=<resource-group> NSG=<nsg-name> MY_IP=<your-ip> ENCODER_IP=<encoder-ip> \
  ./deploy/azure-vm/nsg-rules.sh
```

| Port | Proto | Purpose | Source |
|------|-------|---------|--------|
| 10080 | UDP | SRT ingest | your encoder |
| 1935 | TCP | RTMP ingest | your encoder |
| 2443 | TCP | mgmt UI / API | your IP |
| 8000 | UDP | WebRTC preview (optional) | your encoder |

SSH (22) is covered by Azure's default rules. Forwarding **out** to
YouTube/Facebook (443/1935) is outbound and allowed by default.

## 3. Use it
1. Open `https://<vm-ip>:2443/mgmt` (accept the self-signed cert) and set the
   mgmt password.
2. In the **Scenario** tab, copy the **SRT publish URL** and push a stream
   (OBS, or `ffmpeg -re -stream_loop -1 -i input.mp4 -c copy -f mpegts "<SRT-URL>"`).
3. Add a **Forward** with your YouTube/Facebook RTMP server + stream key.

## Notes
- HTTPS uses a self-signed cert by default; configure a real cert under
  Settings → HTTPS (manual upload) if you expose the mgmt UI.
- Config, the redis state, and the mgmt password persist in `~/oryx-data`.
- `docker logs -f oryx` to watch it; a healthy idle log shows SRS up and
  `forward start to run tasks`.
