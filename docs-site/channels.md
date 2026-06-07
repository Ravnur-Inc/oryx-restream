# Channels — routes

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
- **Monitor** — each channel has a **Monitor** button that opens a dedicated
  full-screen view (live preview + contribution and per-output health). See
  **[Monitor](monitor.md)**.

## Health at a glance
Each channel shows a **SOURCE** badge and, when expanded, a **health badge** per
destination plus live FPS / bitrate / speed:

| Badge | Meaning |
|-------|---------|
| **● HEALTHY** (green) | Forwarding in real time. |
| **▲ DEGRADED** (amber) | Falling behind (FFmpeg speed below ~0.94×, i.e. it can't push to the destination fast enough; expect buffering/drops). |
| **■ DOWN** (red) | The source is live but this output isn't forwarding. |
| **○ WAITING** | Enabled, but the source isn't publishing yet. |
| **○ OFF** | The destination is toggled off. |
| **⊘ BLOCKED** (orange) | Another channel is using this shared destination. |

The channel header also flags **"▲ N need attention"** when any output is degraded
or down.

## Shared destinations & the BLOCKED badge
If two channels attach the same destination (e.g. both forward to "City YouTube"):

- Whichever channel goes live first **owns** that destination and streams to it.
- The other channel's copy shows **⊘ BLOCKED** — its *other* destinations keep
  streaming normally.
- When the first channel stops (encoder offline or you Stop it), the destination
  frees and the waiting channel **takes over automatically** within a few seconds.

This is by design — it guarantees a destination is never double-sent.

!!! note "Unmanaged streams"
    If something publishes a stream name that isn't one of your channels (a test
    push, a leftover, or the wrong name), the Channels page shows a
    "⚠ N unmanaged stream(s) publishing" notice listing them. Create a channel
    with that stream name to manage and forward it.
