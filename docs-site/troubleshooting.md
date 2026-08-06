# Troubleshooting

??? question "YouTube shows \"Preparing stream\" forever (quality says excellent)"
    Set the encoder **keyframe interval to 2s** and restart the stream. Forwarding
    is pass-through, so YouTube needs the keyframes from your encoder.

??? question "YouTube: \"More than one ingestion is using the primary URL\""
    Two sources are hitting the same YouTube key. Make sure there's a **single**
    "City YouTube" in **Destinations** and attach *that* to your channels — a
    shared destination shows **BLOCKED** on the second channel instead of
    double-sending. If a leftover duplicate target exists, fix it in
    **Destinations** (edit/delete) or detach it from the channel.

??? question "A destination shows ⊘ BLOCKED"
    Expected when another channel is currently streaming to that shared
    destination. It takes over when the other channel stops. To force it, Stop the
    other channel's copy.

??? question "The encoder says \"connected\" but the channel stays IDLE"
    A connected SRT socket is not a publish. The **Monitor** view says which of the
    two is happening — its idle placeholder now names the cause instead of just
    "waiting":

    - *"Publisher connected under a different name"* — the feed arrived, but under a
      different stream than this channel expects. The encoder's **Stream ID** (or
      RTMP stream key) is wrong or was truncated. Re-copy it from the channel's
      **Ingest URLs → Hardware encoder** block; see
      [Encoder settings](encoder-settings.md#hardware-teradek-prism-haivision-makito-srt).
    - *"Publisher connected, but not registered"* — the media server has the stream
      but the publish key was rejected. Check the channel's ingest URLs against the
      **Ingest** page's publish key (rotating the key invalidates every old URL).
    - *"Source is idle"* with nothing else — nothing is publishing at all. The most
      common cause on hardware encoders is a stream ID that lost its leading
      `#!::` or its trailing `,m=publish`, which makes the server treat the
      encoder as a viewer: the socket connects and stays up, and no video is ever
      ingested.

    Also confirm the encoder is sending **H.264 + AAC**; HEVC and non-AAC audio
    can't cross the SRT-to-RTMP bridge.

??? question "SRT video is blocky / frames overlap"
    The server is tuned for lossy SRT; this is usually the encoder's uplink. Use a
    wired connection, raise the encoder's SRT latency, and use the channel's SRT
    URL as-is (it carries the recommended parameters).

??? question "\"Your connection is not secure\" / blank page"
    Use the full `https://<your-host>/mgmt` (the domain the certificate is for, not
    a raw IP). If a stale cache is involved, hard-refresh or clear the site's data.

??? question "An action failed"
    Errors appear as a descriptive banner in the page (e.g. "this destination is
    already attached to this channel"). Read the message — it states the exact
    cause.

??? question "Microsoft sign-in fails"
    Either Entra isn't configured on this deployment, or your account isn't a
    registered user (ask an owner to add you in **Users**).
