# Concepts

| Term | Meaning |
|------|---------|
| **Stream name** | The name you publish under (e.g. `sunday-service`). Each distinct name is a separate stream. |
| **Publish key** | A shared secret that authorizes publishing. It's embedded in the ingest URLs. |
| **Ingest URL** | The RTMP or SRT URL your encoder pushes to. Built from the host + stream name + publish key. |
| **Destination** | A place you forward to: a label + RTMP server URL + stream key (e.g. "City YouTube"). Saved in the **Destinations** library and reusable. |
| **Channel** | A reusable *route*: a named ingest plus the destinations it forwards to. |
| **Forward (job)** | The underlying "send stream X to destination Y" job, created automatically when you attach a destination to a channel. You manage it from the channel — there is no separate Forward screen. |

!!! warning "The golden rule: one feed per destination"
    A destination can be attached to several channels, but **only one channel
    streams to it at a time**. If a second channel goes live while the first is
    using a shared destination, that destination shows **⊘ BLOCKED** for the
    second channel until the first frees it (then it takes over automatically).
    This prevents two streams hitting the same YouTube/Facebook key at once.
