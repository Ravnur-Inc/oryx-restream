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
