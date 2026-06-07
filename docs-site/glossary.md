# Glossary

- **SRT** — low-latency, loss-resilient transport for contribution over the
  internet. Preferred for remote/lossy uplinks.
- **RTMP / RTMPS** — common streaming protocol (RTMPS = encrypted). Used for
  ingest and for most forward destinations.
- **Forward / Simulcast** — sending one input to multiple outputs at once.
- **Stream key / Publish key** — secret that authorizes publishing, or that a
  platform (YouTube/Facebook) uses to identify your broadcast.
- **GOP / keyframe interval** — how often a full frame is sent; 2s is required
  for YouTube.
- **Contribution feed** — the incoming stream you publish to the server.
- **Egress** — an outgoing forward to a destination.
