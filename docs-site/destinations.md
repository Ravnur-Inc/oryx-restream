# Destinations — your reusable targets

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

!!! tip "Reuse across channels"
    Save "City YouTube" once and attach it to several channels — at runtime only
    one channel streams to it at a time (the others show **⊘ BLOCKED**), so a
    shared target is never double-sent. See **[Concepts](concepts.md)**.
