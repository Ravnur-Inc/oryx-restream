//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
// Shared builder for ingest/publish URLs, used by the Ingest and Channels
// screens so the format (especially the tuned SRT params and optional AES
// passphrase) stays consistent in one place.

export function buildIngestUrls({host, srtPort = "10080", name, secret = "", srtPassphrase = "", srtPbkeylen = "16", origin}) {
  const n = (name && name.trim()) || "livestream";
  const secretQ = secret ? `?secret=${secret}` : "";
  const enc = srtPassphrase ? `&passphrase=${srtPassphrase}&pbkeylen=${srtPbkeylen}` : "";
  const streamId = `#!::r=live/${n}${secretQ},m=publish`;
  return {
    rtmpServer: `rtmp://${host}/live/`,
    rtmpKey: secret ? `${n}?secret=${secret}` : n,
    srtStreamId: streamId,
    // Includes the proven latency/buffer params (and passphrase when encrypted).
    srtUrl: `srt://${host}:${srtPort}?mode=caller&latency=1000&pkt_size=1316&rcvbuf=8388608${enc}&streamid=${streamId}`,
    hlsUrl: `${origin}/live/${n}.m3u8`,
    encrypted: !!srtPassphrase,
  };
}
