# Encoder settings

**All encoders:** H.264, **CBR**, **keyframe interval = 2 seconds** (required —
YouTube stalls on "Preparing stream" without frequent keyframes).

## OBS — SRT
Settings → Stream → Service **Custom** → Server = the channel's **SRT Ingest URL**,
Stream Key blank. Output → Advanced → keyframe interval 2s.

## OBS — RTMP
Service **Custom** → Server + Stream Key from the channel's **Ingest URLs**.

## Hardware (Teradek Prism, Haivision Makito) — SRT
In the SRT output:

- Mode **Caller**, Address `<your-host>`, Port `10080`
- **Stream ID** = the channel's *Stream ID* value
- Latency `1000` ms
- **Passphrase** field: only if SRT encryption is enabled — paste the Ingest page's
  *Passphrase* here (never the stream key).
