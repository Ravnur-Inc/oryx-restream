# Troubleshooting

??? question "YouTube shows \"Preparing stream\" forever (quality says excellent)"
    Set the encoder **keyframe interval to 2s** and restart the stream. Forwarding
    is pass-through, so YouTube needs the keyframes from your encoder.

??? question "YouTube reconnects every few seconds / speed shows above 1.5x"
    The destination drops and reconnects on a short loop, the framerate at YouTube
    reads higher than the encoder is sending, and the **Monitor** looks jittery.

    A speed above 1.0x means the video's timestamps are advancing faster than real
    time. The restreamer detects this and restarts the forward, so the reconnects
    are the symptom being reported rather than the cause. A brief spike right after
    a channel starts is normal; sustained is not — anything held above 1.5x for
    about 15 seconds triggers a restart.

    **First, check the server version.** Deployments before August 2026 shipped
    without the `time_jitter` setting, which let the media server rewrite timestamps
    on the pass-through path and produced exactly this failure on 60fps sources.
    Updating to the current release fixes it. That was the cause the first time this
    was seen in production, and it is not an encoder problem — no encoder setting
    works around it.

    If you are on a current release and still see it, the cause is upstream on the
    encoder. Set the frame rate to **Automatic / follow-input** rather than forcing a
    value, confirm the encoder's video input is *locked* and detected as the format
    you expect, and confirm the audio is 48 kHz AAC.

    **Measuring it** — an operator with shell access can measure the ingest with the
    destination taken out of the picture:

    ```
    ffmpeg -t 60 -i rtmp://localhost/live/<stream> -c copy -f null -
    ```

    Read the final line. `speed=1.0x` means ingest is healthy. Above that, divide
    `frame=` by the `elapsed=` wall time and compare it to the encoder's configured
    frame rate:

    - **Close to the configured rate** — frames are arriving correctly and only the
      timestamps are wrong. Repeated `Non-monotonic DTS` warnings on the audio are
      the same fault seen from the other side.
    - **Roughly double the configured rate** — genuinely twice as much video is
      arriving, which means two sources are publishing to one channel. See the
      duplicate-ingestion entry below.

    To decide whether the encoder or the server is at fault, publish a known-good
    test stream from the server itself and measure that. If a synthetic source shows
    the same inflation, the encoder is exonerated.

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
