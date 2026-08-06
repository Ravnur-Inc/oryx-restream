//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
// Shared builder for ingest/publish URLs, used by the Ingest and Channels
// screens so the format (especially the tuned SRT params and optional AES
// passphrase) stays consistent in one place.

// Caller-side SRT latency we advertise to encoders. Deliberately higher than the
// server's `latency 200` in containers/conf/srs.release.conf: SRT negotiates the
// max of the two peers, so this raises the buffer for real-world (lossy WAN)
// contribution without loosening the server default used by LAN sources.
export const SRT_LATENCY_MS = 1000;

export function buildIngestUrls({host, srtPort = "10080", name, secret = "", srtPassphrase = "", srtPbkeylen = "16", origin}) {
  const n = (name && name.trim()) || "livestream";
  const secretQ = secret ? `?secret=${secret}` : "";
  const enc = srtPassphrase ? `&passphrase=${srtPassphrase}&pbkeylen=${srtPbkeylen}` : "";
  const streamId = `#!::r=live/${n}${secretQ},m=publish`;
  return {
    rtmpServer: `rtmp://${host}/live/`,
    rtmpKey: secret ? `${n}?secret=${secret}` : n,
    // Discrete fields for hardware encoders (Haivision Makito, Teradek, …) whose
    // UIs take address / port / stream ID separately and cannot accept a URL.
    // Never make the operator hand-extract these out of srtUrl: the `#` in the
    // stream ID is a fragment marker, so pasting the whole URL into anything that
    // URL-parses it silently drops `m=publish` — SRS then treats the session as a
    // player, the encoder still shows "connected", and nothing ever publishes.
    srtHost: host,
    srtPort: String(srtPort),
    srtStreamId: streamId,
    srtLatency: String(SRT_LATENCY_MS),
    srtPassphrase,
    // Includes the proven latency/buffer params (and passphrase when encrypted).
    srtUrl: `srt://${host}:${srtPort}?mode=caller&latency=${SRT_LATENCY_MS}&pkt_size=1316&rcvbuf=8388608${enc}&streamid=${streamId}`,
    hlsUrl: `${origin}/live/${n}.m3u8`,
    encrypted: !!srtPassphrase,
  };
}
