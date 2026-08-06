# Encoder settings

**All encoders:** H.264, **CBR**, **keyframe interval = 2 seconds** (required —
YouTube stalls on "Preparing stream" without frequent keyframes).

## OBS — SRT
Settings → Stream → Service **Custom** → Server = the channel's **SRT Ingest URL**,
Stream Key blank. Output → Advanced → keyframe interval 2s.

## OBS — RTMP
Service **Custom** → Server + Stream Key from the channel's **Ingest URLs**.

## Hardware (Teradek Prism, Haivision Makito) — SRT
Hardware encoders take the connection as separate fields, not as a URL. Open the
channel's **Ingest URLs** and use the **Hardware encoder (SRT caller)** block —
every field there maps one-to-one onto the encoder, so nothing has to be typed or
edited by hand:

| Encoder field | Copy from |
|---|---|
| Mode | **Caller** |
| Address / Host | **SRT address** |
| Destination port | **SRT port** (`10080`) |
| Stream ID | **SRT stream ID** |
| Latency | **SRT latency (ms)** (`1000`) |
| Passphrase / Encryption | **SRT passphrase** — only shown when SRT encryption is on |

!!! warning "Copy the Stream ID exactly"
    The stream ID looks like `#!::r=live/<channel>?secret=<key>,m=publish` and every
    character matters. The leading `#!::` tells the server how to read it and the
    trailing `,m=publish` is what marks the session as a *publisher*.

    Do **not** paste the full `srt://…` URL into the encoder's address field. Many
    devices URL-parse it, and a URL treats everything after `#` as a fragment — so
    the stream ID is silently dropped. The handshake still succeeds and the encoder
    still reports **Connected**, but the server treats the session as a viewer and
    the channel stays **IDLE**.

### Haivision Makito X4
Under **Outputs → SRT**: *Mode* Caller, *Address* and *Destination Port* from the
table above, *Latency* `1000`, and the **Stream ID** field pasted verbatim. Leave
*Encryption* off unless a passphrase is shown on the Ingest page. Video **H.264**,
audio **AAC** — the SRT-to-RTMP bridge can't carry HEVC or non-AAC audio.
