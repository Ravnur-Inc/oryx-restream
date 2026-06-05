//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
// A self-contained HTTP-FLV player (flv.js) that fits its container. Renders a
// responsive 16:9 box with the video scaled to fit (letterboxed, never cropped),
// so it never overflows/clips like an embedded native-size player.
import React from "react";
import flvjs from "flv.js";

export default function FlvPlayer({url, style}) {
  const videoRef = React.useRef(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    setError(null);
    if (!flvjs.isSupported()) {
      setError("This browser can't play FLV (no MSE support).");
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    const player = flvjs.createPlayer(
      {type: "flv", url, isLive: true, hasAudio: true, hasVideo: true},
      {enableStashBuffer: false, stashInitialSize: 128, liveBufferLatencyChasing: true, autoCleanupSourceBuffer: true},
    );
    let destroyed = false;
    const onErr = () => { if (!destroyed) setError("Stream unavailable — is it publishing right now?"); };
    player.on(flvjs.Events.ERROR, onErr);
    try {
      player.attachMediaElement(video);
      player.load();
      const p = video.play();
      if (p && p.catch) p.catch(() => {}); // autoplay may need a click; ignore
    } catch (e) {
      setError(e.message || "Failed to start playback");
    }

    return () => {
      destroyed = true;
      try { player.off(flvjs.Events.ERROR, onErr); } catch {}
      try { player.pause(); } catch {}
      try { player.unload(); } catch {}
      try { player.detachMediaElement(); } catch {}
      try { player.destroy(); } catch {}
    };
  }, [url]);

  return (
    <div style={{position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#000", borderRadius: 6, overflow: "hidden", ...style}}>
      <video
        ref={videoRef}
        controls
        muted
        playsInline
        style={{position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#000"}}
      />
      {error && (
        <div role="alert" style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          textAlign: "center", padding: 16, color: "#fca5a5",
          fontFamily: "'Public Sans', sans-serif", fontSize: 13, background: "rgba(0,0,0,0.65)",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
