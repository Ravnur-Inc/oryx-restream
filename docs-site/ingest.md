# Ingest — publish key & encoder reference

!!! note "Where are the ingest URLs?"
    Each **Channel** shows its own ready-to-copy RTMP/SRT/HLS URLs (expand the
    channel → **Ingest URLs**). The **Ingest** tab is for the shared publish key
    and encoder reference, not per-stream URLs.

The **Ingest** tab shows:

- **Publish key** — the single shared secret that authorizes publishing (embedded
  in every channel's ingest URLs). **Reveal** it, or (owner) **Rotate** it —
  rotating invalidates all current ingest URLs, so only do it if the key leaks.
- **SRT encryption** — an **on/off toggle** (owner). Turn it on and the system
  generates a strong **passphrase** (you can edit it or **Regenerate**, and pick
  the AES key length 128/192/256). The passphrase goes in your encoder's
  *Passphrase/Encryption* field (never the stream key); OBS picks it up
  automatically from the channel's SRT URL.
- **Recommended encoder settings** — H.264, CBR, keyframe 2s, and the hardware
  (Teradek/Haivision) SRT field mapping.

!!! warning "Toggling SRT encryption restarts the server"
    Changing the SRT-encryption toggle **restarts the streaming server (~10–20s)**
    — all active streams reconnect and the UI is briefly unavailable; the page
    reloads itself when it's back. Non-owners see the current status and passphrase
    (read-only).

See the **[Encoder settings](encoder-settings.md)** cheat-sheet for exact settings.
