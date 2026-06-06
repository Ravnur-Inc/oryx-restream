# Ravnur Simulcast Manager — User Guide

A guide for operators using the management UI to ingest a live stream and
restream ("simulcast") it to multiple destinations such as YouTube, Facebook, or
the Ravnur Media Platform.

> **Keep this current:** any change that affects what a user sees or does in the
> UI should update this guide in the same pull request. See
> [Maintaining this guide](#maintaining-this-guide).

---

## Contents
- [What it does](#what-it-does)
- [The interface](#the-interface)
- [Signing in & roles](#signing-in--roles)
- [Concepts](#concepts)
- [Quick start: publish your first stream](#quick-start-publish-your-first-stream)
- [Ingest — publish key & encoder reference](#ingest--publish-key--encoder-reference)
- [Destinations — your reusable targets](#destinations--your-reusable-targets)
- [Channels — routes](#channels--routes)
- [Monitor — one channel at a glance](#monitor--one-channel-at-a-glance)
- [Users & roles](#users--roles)
- [System health](#system-health)
- [Common workflows](#common-workflows)
- [Encoder setup cheat-sheet](#encoder-setup-cheat-sheet)
- [Troubleshooting](#troubleshooting)
- [Administration](#administration)
- [Glossary](#glossary)
- [Maintaining this guide](#maintaining-this-guide)

---

## What it does
You send **one** live stream into the server (over **SRT** or **RTMP**), and it
**forwards** that stream out to one or more destinations at the same time. You
manage everything from the web UI at `https://<your-host>/mgmt`.

The flow is always: **Ingest** (publish in) → **Channels** (fan it out) →
**Monitor** (confirm it's live and healthy).

---

## The interface
Navigate with the **left sidebar** — **Ingest · Channels · Destinations** (and
**Users** for owners). The top bar shows the current page, your account, and a
**light/dark toggle** (also in the sidebar footer); the app follows your system
theme by default and remembers your choice. On narrow screens / phones the
sidebar collapses to a **☰ menu** button. Sign out from the account menu (top
right).

---

## Signing in & roles
Open `https://<your-host>/mgmt`.

- **Microsoft sign-in (Entra ID):** click **Sign in with Microsoft**. Only
  registered users can get in; unregistered accounts see an "access denied" page.
- **Password:** if Entra isn't enabled for your deployment, sign in with the
  management password.

**Roles:**
- **Owner** — full access, including **Users** management and owner-only controls
  (e.g. rotating the publish key and the SRT-encryption toggle).
- **Editor** — day-to-day operation: **Ingest**, **Channels** (incl. **Monitor**),
  **Destinations**. Owner-only controls are hidden.

---

## Concepts
| Term | Meaning |
|------|---------|
| **Stream name** | The name you publish under (e.g. `sunday-service`). Each distinct name is a separate stream. |
| **Publish key** | A shared secret that authorizes publishing. It's embedded in the ingest URLs. |
| **Ingest URL** | The RTMP or SRT URL your encoder pushes to. Built from the host + stream name + publish key. |
| **Destination** | A place you forward to: a label + RTMP server URL + stream key (e.g. "City YouTube"). Saved in the **Destinations** library and reusable. |
| **Channel** | A reusable *route*: a named ingest plus the destinations it forwards to. |
| **Forward (job)** | The underlying "send stream X to destination Y" job, created automatically when you attach a destination to a channel. You manage it from the channel — there is no separate Forward screen. |

**The golden rule:** a destination can be attached to several channels, but **only
one channel streams to it at a time**. If a second channel goes live while the
first is using a shared destination, that destination shows **⊘ BLOCKED** for the
second channel until the first frees it (then it takes over automatically). This
prevents two streams hitting the same YouTube/Facebook key at once.

---

## Quick start: publish your first stream
1. **Channels** → **+ Add Channel** → give it a label and a **Stream name**
   (e.g. `sunday-service`).
2. Expand the channel (**Manage**) → **Ingest URLs** → copy the **SRT** or
   **RTMP** URL.
3. In your encoder (OBS, Teradek, Haivision…), paste the URL and set
   **keyframe interval = 2s**, **H.264**, **CBR**. Start streaming.
4. On the channel, click **Monitor** → the source shows **HEALTHY** with a live
   preview within a few seconds.
5. Back in the channel → **Add Destination** (e.g. YouTube) → **Start**. Your
   stream is now live on that destination.

---

## Ingest — publish key & encoder reference
> **Where are the ingest URLs?** Each **Channel** shows its own ready-to-copy
> RTMP/SRT/HLS URLs (expand the channel → **Ingest URLs**). The **Ingest** tab is
> for the shared publish key and encoder reference, not per-stream URLs.

The **Ingest** tab shows:
- **Publish key** — the single shared secret that authorizes publishing (embedded
  in every channel's ingest URLs). **Reveal** it, or (owner) **Rotate** it —
  rotating invalidates all current ingest URLs, so only do it if the key leaks.
- **SRT encryption** — an **on/off toggle** (owner). Turn it on and the system
  generates a strong **passphrase** (you can edit it or **Regenerate**, and pick
  the AES key length 128/192/256). The passphrase goes in your encoder's
  *Passphrase/Encryption* field (never the stream key); OBS picks it up
  automatically from the channel's SRT URL. **Changing the toggle restarts the
  streaming server (~10–20s)** — all active streams reconnect and the UI is
  briefly unavailable; the page reloads itself when it's back. Non-owners see the
  current status and passphrase (read-only).
- **Recommended encoder settings** — H.264, CBR, keyframe 2s, and the hardware
  (Teradek/Haivision) SRT field mapping.

See the [encoder cheat-sheet](#encoder-setup-cheat-sheet) for exact settings.

---

## Destinations — your reusable targets
The **Destinations** tab is a library of the places you forward to. Save a target
once and reuse it across channels.

- **+ Add Destination** — give it a **Label** (e.g. "City YouTube"), the **RTMP
  Server URL**, and the **Stream Key**.
  - *YouTube:* Server `rtmp://a.rtmp.youtube.com/live2/` + your stream key from
    YouTube Studio → Go Live → Stream settings.
  - *Facebook:* Server `rtmps://live-api-s.facebook.com:443/rtmp/` + your key.
  - *Custom:* any RTMP/RTMPS URL + key.
- **Edit** — changing a destination's server/key updates it everywhere it's
  attached, and restarts any live forward using it.
- **Delete** — blocked while the destination is attached to a channel; detach it
  first (the card tells you where it's attached).

---

## Channels — routes
A **Channel** bundles a named ingest with the destinations it forwards to — the
thing you actually operate for a recurring show or input.

- **+ Add Channel** — set a **Label** (e.g. "Sunday Service") and a **Stream
  name** (e.g. `sunday-service`). Encoders publish to this stream name.
- **Manage** (expand a channel) to:
  - **+ Add Destination** — attach **from the library** (or create a new one).
    The same destination can be attached to multiple channels.
  - **Start all / Stop all** — enable/disable every destination at once.
  - Per-destination **toggle** (start/stop one) and **Detach** (remove from this
    channel; the destination stays in the library).
  - **Ingest URLs** — the channel's RTMP/SRT URLs to copy.
- **Health at a glance** — each channel shows a **SOURCE** badge and, when
  expanded, a **health badge** per destination plus live FPS / bitrate / speed:
  - **● HEALTHY** (green) — forwarding in real time.
  - **▲ DEGRADED** (amber) — falling behind (FFmpeg speed below ~0.94×, i.e. it
    can't push to the destination fast enough; expect buffering/drops).
  - **■ DOWN** (red) — the source is live but this output isn't forwarding.
  - **○ WAITING** — enabled, but the source isn't publishing yet.
  - **○ OFF** — the destination is toggled off.
  - **⊘ BLOCKED** (orange) — another channel is using this shared destination.
  The channel header also flags **"▲ N need attention"** when any output is
  degraded or down.
- **Monitor** — each channel has a **Monitor** button that opens a dedicated
  full-screen view (live preview + contribution and per-output health). See
  [Monitor](#monitor--one-channel-at-a-glance).

### Shared destinations & the BLOCKED badge
If two channels attach the same destination (e.g. both forward to "City
YouTube"):
- Whichever channel goes live first **owns** that destination and streams to it.
- The other channel's copy shows **⊘ BLOCKED** — its *other* destinations keep
  streaming normally.
- When the first channel stops (encoder offline or you Stop it), the destination
  frees and the waiting channel **takes over automatically** within a few seconds.

This is by design — it guarantees a destination is never double-sent.

---

## Monitor — one channel at a glance
Click **Monitor** on any channel card to open its dedicated view — the "single
pane of glass" for one broadcast:

- **Live preview** — the contribution feed plays in-browser (the fitted player,
  no cropping). When the source is idle it shows a "waiting for a publisher"
  placeholder instead.
- **Contribution health** — a HEALTHY / STALLED / IDLE badge plus video codec,
  resolution, audio codec, bitrate and uptime.
- **Outputs** — every attached destination with its egress health badge
  (HEALTHY / DEGRADED / DOWN / WAITING / OFF / BLOCKED) and live FPS / bitrate /
  speed.

It refreshes every few seconds. Use **← Channels** (or the nav) to go back. The
view is per-channel; there is no all-channels wall (yet).

- **Reset source** — when the source is live, a **Reset source** button
  disconnects the current publisher so the encoder reconnects automatically. Use
  it to recover a stuck/frozen feed.

> **Unmanaged streams:** if something publishes a stream name that isn't one of
> your channels (a test push, a leftover, or the wrong name), the **Channels**
> page shows a "⚠ N unmanaged stream(s) publishing" notice listing them. Create a
> channel with that stream name to manage and forward it.

---

## Users & roles
*(Owner only.)* The **Users** tab manages who can sign in with Microsoft. Access
is granted by **email** — a user signs in with the Microsoft account matching the
email you add here.

- **+ Add User** — first name, last name, **email** (their Microsoft sign-in
  address), **role** (owner/editor), and **Send an invite email** (on by default).
- **Invite email:** if email is configured on the server, the new user is emailed
  a sign-in link. If email **isn't** configured (or sending fails), you get a
  **copyable sign-in link** to send them yourself — the invite still works either
  way.
- **Status:**
  - **○ INVITED** — added but hasn't signed in yet. You can **Resend** the invite
    or **Cancel** it (removes the pending user).
  - **● ACTIVE** — has signed in at least once (shows last sign-in date). Status
    flips automatically on their first sign-in.
- Owners can edit users and delete active ones; you can't delete your own account.

> **Enabling invite emails:** set `SMTP_HOST` + `SMTP_FROM` (and usually
> `SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`) on the server, plus `MGMT_BASE_URL` (the
> public mgmt URL used in the link). See the
> [deployment guide](../deploy/azure-vm/README.md#invite-emails-optional-smtp).
> Without SMTP, invites fall back to the copyable link.

---

## System health
*(Owner only.)* The **System** tab is a live at-a-glance health panel (refreshes
every 5s): host **CPU load**, **memory**, and **disk** usage, plus application
signals — whether the **SRS media server** is up, the number of active **FFmpeg
forwards**, goroutines/threads, and host/process **uptime**. Bars turn amber/red
as usage climbs. It's a snapshot, not a history — for graphs, alerting, and
notifications, enable **Azure Monitor** on the VM (see the
[deployment guide](../deploy/azure-vm/README.md#monitoring)).

---

## Common workflows

**Recurring show (reuse a channel).**
Create one channel (e.g. "Sunday Service" / `sunday-service`) with its
destinations attached. Each week, just publish to that stream name and Start —
the route is already set up.

**Multiple inputs at a venue.**
Create a channel per input (e.g. `main-stage`, `stage-2`, `interview`), each with
its own destinations. Each encoder publishes to its channel's stream name.

**Shared destination across channels (e.g. Council + PAO both use City YouTube).**
1. **Destinations** → create "City YouTube" once.
2. **Channels → City Council Meetings** → attach City YouTube (+ its Ravnur).
3. **Channels → PAO** → attach the *same* City YouTube (+ Ravnur PAO + Facebook).
4. When Council is live, it owns City YouTube; if PAO also goes live, PAO's City
   YouTube shows **BLOCKED** while its other outputs run. Stop Council → PAO's
   YouTube takes over automatically.

---

## Encoder setup cheat-sheet

**All encoders:** H.264, **CBR**, **keyframe interval = 2 seconds** (required —
YouTube stalls on "Preparing stream" without frequent keyframes).

**OBS — SRT:** Settings → Stream → Service **Custom** → Server = the Ingest
page's SRT URL, Stream Key blank. Output → Advanced → keyframe interval 2s.

**OBS — RTMP:** Service **Custom** → Server + Stream Key from the Ingest page.

**Hardware (Teradek Prism, Haivision Makito) — SRT:** in the SRT output:
- Mode **Caller**, Address `<your-host>`, Port `10080`
- **Stream ID** = the Ingest page's *Stream ID* value
- Latency `1000` ms
- **Passphrase** field: only if SRT encryption is enabled — paste the Ingest
  page's *Passphrase* here (never the stream key).

---

## Troubleshooting

**YouTube shows "Preparing stream" forever (quality says excellent).**
Set the encoder **keyframe interval to 2s** and restart the stream. Forwarding is
pass-through, so YouTube needs the keyframes from your encoder.

**YouTube: "More than one ingestion is using the primary URL."**
Two sources are hitting the same YouTube key. Make sure there's a **single**
"City YouTube" in **Destinations** and attach *that* to your channels — a shared
destination will show **BLOCKED** on the second channel instead of double-sending.
If a leftover duplicate target exists, fix it in **Destinations** (edit/delete) or detach it from the channel.

**A destination shows ⊘ BLOCKED.**
Expected when another channel is currently streaming to that shared destination.
It will take over when the other channel stops. To force it, Stop the other
channel's copy.

**SRT video is blocky / frames overlap.**
The server is tuned for lossy SRT; this is usually the encoder's uplink. Use a
wired connection, raise the encoder's SRT latency, and use the Ingest page's SRT
URL as-is (it carries the recommended parameters).

**"Your connection is not secure" / blank page.**
Use the full `https://<your-host>/mgmt` (the domain the certificate is for, not a
raw IP). If a stale cache is involved, hard-refresh or clear the site's data.

**An action failed.**
Errors now appear as a descriptive banner in the page (e.g. "this destination is
already attached to this channel"). Read the message — it states the exact cause.

**Microsoft sign-in fails.**
Either Entra isn't configured on this deployment, or your account isn't a
registered user (ask an owner to add you in **Users**).

---

## Administration
*(Owner / operator tasks — see the [deployment guide](../deploy/azure-vm/README.md)
for full setup and upgrades.)*

- **Install / upgrade:** `deploy/azure-vm/setup.sh` (clone/build/run); pull the
  latest and re-run to upgrade.
- **HTTPS/TLS:** auto-renewing Let's Encrypt via `deploy/azure-vm/certbot-setup.sh`.
- **Microsoft Entra sign-in:** set `ENTRA_CLIENT_ID` (+ `ENTRA_BOOTSTRAP_EMAIL`
  for the first owner) before running setup; add the SPA redirect URI in the
  Azure app registration.
- **SRT encryption (optional):** set `SRT_PASSPHRASE` (and `SRT_PBKEYLEN`) to
  require AES on SRT ingest; the Ingest page then shows the passphrase to use.
- **Container image:** `ghcr.io/ravnur-inc/oryx-restream` (versioned tags).

---

## Glossary
- **SRT** — low-latency, loss-resilient transport for contribution over the
  internet. Preferred for remote/lossy uplinks.
- **RTMP / RTMPS** — common streaming protocol (RTMPS = encrypted). Used for
  ingest and for most forward destinations.
- **Forward / Simulcast** — sending one input to multiple outputs at once.
- **Stream key / Publish key** — secret that authorizes publishing or that a
  platform (YouTube/Facebook) uses to identify your broadcast.
- **GOP / keyframe interval** — how often a full frame is sent; 2s is required
  for YouTube.

---

## Maintaining this guide
This guide is the user-facing reference and must track the UI. When a change adds
or alters something a user sees or does:
1. Update the relevant section here in the **same pull request** as the change.
2. Note user-facing changes in [`RAVNUR-CHANGES.md`](../RAVNUR-CHANGES.md) too
   (the engineering changelog).
3. Keep screenshots/wording in sync with the current screens (Ingest, Channels,
   Monitor, Destinations, Users).
