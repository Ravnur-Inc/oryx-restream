//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
// A self-contained HTTP-FLV player (flv.js) that fits its container. Renders a
// responsive 16:9 box with the video scaled to fit (letterboxed, never cropped).
//
// It is resilient to the common live-preview startup race: flv.js often errors
// once because the player attaches a beat before the stream's first keyframe is
// available. Instead of giving up permanently, it auto-reconnects with a short
// delay (so it self-heals when the stream becomes ready) and always offers a
// manual reload button. This is a *preview* of the contribution feed; it is
// independent of the ingest/forward pipeline, so a hiccup here never affects the
// actual restream.
import React from "react";
import flvjs from "flv.js";
import {Loader, ActionIcon, Tooltip, Button} from "@mantine/core";
import {IconRefresh} from "@tabler/icons-react";

const RETRY_MS = 2500;       // delay between reconnect attempts
const MAX_ATTEMPTS = 24;     // ~1 min of retries before falling back to idle

export default function FlvPlayer({url, style}) {
  const videoRef = React.useRef(null);
  // status: "connecting" | "playing" | "idle" | "unsupported"
  const [status, setStatus] = React.useState("connecting");
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (!flvjs.isSupported()) {
      setStatus("unsupported");
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    let destroyed = false;
    let player = null;
    let retryTimer = null;
    let attempts = 0;
    setStatus("connecting");

    const cleanupPlayer = () => {
      if (!player) return;
      try { player.pause(); } catch {}
      try { player.unload(); } catch {}
      try { player.detachMediaElement(); } catch {}
      try { player.destroy(); } catch {}
      player = null;
    };

    const onErr = () => {
      if (destroyed) return;
      cleanupPlayer();
      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) { setStatus("idle"); return; }
      setStatus("connecting");
      retryTimer = setTimeout(start, RETRY_MS);
    };

    const start = () => {
      if (destroyed) return;
      cleanupPlayer();
      // Let flv.js auto-detect tracks (don't force hasAudio/hasVideo — a briefly
      // absent track would otherwise throw a demux error).
      player = flvjs.createPlayer(
        {type: "flv", url, isLive: true},
        {enableStashBuffer: false, stashInitialSize: 128, liveBufferLatencyChasing: true, autoCleanupSourceBuffer: true},
      );
      player.on(flvjs.Events.ERROR, onErr);
      try {
        player.attachMediaElement(video);
        player.load();
        const p = video.play();
        if (p && p.catch) p.catch(() => {}); // autoplay may need a click; ignore
      } catch (e) {
        onErr();
      }
    };

    const onPlaying = () => { if (!destroyed) { attempts = 0; setStatus("playing"); } };
    video.addEventListener("playing", onPlaying);

    start();

    return () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      video.removeEventListener("playing", onPlaying);
      cleanupPlayer();
    };
  }, [url, reloadKey]);

  // Force a fresh player (resets the retry counter via the effect re-run).
  const reload = () => { setStatus("connecting"); setReloadKey(k => k + 1); };

  const overlayBase = {
    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center",
    padding: 16, background: "rgba(0,0,0,0.6)",
    fontFamily: "'Public Sans', sans-serif", fontSize: 13,
  };

  return (
    <div style={{position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#000", borderRadius: 6, overflow: "hidden", ...style}}>
      <video
        ref={videoRef}
        controls
        muted
        playsInline
        style={{position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#000"}}
      />

      {/* Always-available manual reload — for when the player hangs but the stream is good. */}
      <Tooltip label="Reload player" withArrow>
        <ActionIcon
          onClick={reload}
          variant="filled" color="dark" size="md" radius="xl"
          aria-label="Reload player"
          style={{position: "absolute", top: 8, right: 8, zIndex: 3, opacity: 0.85}}
        >
          <IconRefresh size={16}/>
        </ActionIcon>
      </Tooltip>

      {status === "connecting" && (
        <div role="status" style={{...overlayBase, color: "#cbd5e1"}}>
          <Loader size="sm" color="gray"/>
          <span>Connecting to the stream…</span>
        </div>
      )}
      {status === "idle" && (
        <div role="alert" style={{...overlayBase, color: "#fca5a5"}}>
          <span>Stream unavailable — it may not be publishing yet.</span>
          <Button size="xs" variant="light" leftSection={<IconRefresh size={14}/>} onClick={reload}>
            Reload player
          </Button>
        </div>
      )}
      {status === "unsupported" && (
        <div role="alert" style={{...overlayBase, color: "#fca5a5"}}>
          <span>This browser can't play FLV (no MSE support).</span>
        </div>
      )}
    </div>
  );
}
