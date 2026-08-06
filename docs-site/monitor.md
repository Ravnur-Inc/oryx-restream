# Monitor — one channel at a glance

Click **Monitor** on any channel card to open its dedicated view — the "single
pane of glass" for one broadcast:

- **Live preview** — the contribution feed plays in-browser (fitted, no cropping).
  When the source is idle the placeholder explains *why*: nothing is publishing, a
  publisher arrived under a different stream name (usually a wrong or truncated
  encoder stream ID), or one arrived but its publish key was rejected. See
  [Troubleshooting](troubleshooting.md) for what to do about each.
- **Contribution health** — a HEALTHY / STALLED / IDLE badge plus video codec,
  resolution, audio codec, bitrate and uptime.
- **Outputs** — every attached destination with its egress health badge
  (HEALTHY / DEGRADED / DOWN / WAITING / OFF / BLOCKED) and live FPS / bitrate /
  speed.
- **Reset source** — when the source is live, a **Reset source** button
  disconnects the current publisher so the encoder reconnects automatically. Use
  it to recover a stuck/frozen feed.

It refreshes every few seconds. Use **← Channels** (or the nav) to go back. The
view is per-channel.

!!! info "Health terms"
    See **[Channels](channels.md#health-at-a-glance)** for what each egress badge
    means.
