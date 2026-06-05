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
- [Signing in & roles](#signing-in--roles)
- [Concepts](#concepts)
- [Quick start: publish your first stream](#quick-start-publish-your-first-stream)
- [Ingest — publish key & encoder reference](#ingest--publish-key--encoder-reference)
- [Destinations — your reusable targets](#destinations--your-reusable-targets)
- [Channels — routes](#channels--routes)
- [Streams — monitoring](#streams--monitoring)
- [Users & roles](#users--roles)
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

The flow is always: **Ingest** (publish in) → **Streams** (confirm it's live) →
**Channels** (fan it out).

---

## Signing in & roles
Open `https://<your-host>/mgmt`.

- **Microsoft sign-in (Entra ID):** click **Sign in with Microsoft**. Only
  registered users can get in; unregistered accounts see an "access denied" page.
- **Password:** if Entra isn't enabled for your deployment, sign in with the
  management password.

**Roles:**
- **Owner** — full access, including **Users**, **System/Settings**, and the
  legacy **Scenario** screens.
- **Editor** — day-to-day operation: **Ingest**, **Channels**, **Destinations**,
  **Streams**. Owner-only screens are hidden.

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
4. **Streams** tab → your stream appears as **ACTIVE** within a few seconds.
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
- **SRT encryption** — if enabled on this deployment, the **Passphrase** (AES) to
  put in your encoder's *Passphrase/Encryption* field (never the stream key).
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
- **Status** at a glance: **SOURCE live/idle** (is anyone publishing this stream?)
  and per-destination **● LIVE / ○ IDLE / ⊘ BLOCKED** with live FPS/bitrate.

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

## Streams — monitoring
The **Streams** tab lists **every stream you've defined** — one row per channel —
plus any live publisher that isn't tied to a channel.

- **ACTIVE / IDLE** per stream. A channel's stream stays listed as **IDLE** until
  an encoder publishes to it, then flips to **ACTIVE**. Use the **STATUS** filter
  (All / Active / Idle) or the search box to narrow the list.
- **Stats** (active streams) — **codec, resolution, FPS, bitrate, uptime**.
- **▶ Watch** — play the live stream in the browser. The player fits the modal and
  letterboxes the video (no cropping). Disabled while a stream is idle.
- **✎ Description** — add a note (stored in your browser).
- **⟳ Reset** — disconnect a stuck stream; the encoder reconnects automatically.

> Streams that show as **Unmanaged** are live publishers with no matching channel —
> usually a test push or a leftover. Create a channel with that stream name to
> manage and forward it.

---

## Users & roles
*(Owner only.)* The **Users** tab manages who can sign in with Microsoft.

- **+ Add User** — first name, last name, **email** (their Microsoft sign-in
  address), and **role** (owner/editor).
- Owners can edit/remove users; you can't delete your own account.

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
   Destinations, Streams, Users).
