//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
// Health badges for streams and forward outputs. The derivation functions are
// pure (and unit-tested) so the UI just renders whatever {level,label,detail}
// they return. Levels: healthy | warning | down | blocked | idle.
import React from "react";

// FFmpeg progress lines look like:
//   frame= 1234 fps= 30 q=-1.0 size=… time=00:01:23.45 bitrate=2500.0kbits/s speed=1.0x
// Spaces after "=" are common, so allow optional whitespace.
export function parseFrameLog(log) {
  if (!log) return {fps: null, bitrate: null, speed: null};
  const fps = log.match(/fps=\s*([\d.]+)/);
  const bitrate = log.match(/bitrate=\s*(\S+)/);
  const speed = log.match(/speed=\s*([\d.]+)x/);
  return {
    fps: fps ? parseFloat(fps[1]) : null,
    bitrate: bitrate ? bitrate[1] : null,
    speed: speed ? parseFloat(speed[1]) : null,
  };
}

// Below this multiple of real-time, a copy-forward is failing to push data to
// the destination fast enough (network / destination problem) and will buffer
// then drop frames.
const SPEED_FLOOR = 0.94;

// Contribution feed (the incoming publish). `bitrate` is the 30-second receive
// bitrate in kbps — the robust "data is flowing" signal. An explicit 0 means no
// data is arriving (frozen feed); undefined means "unknown", which we do not
// treat as a fault. (We deliberately do NOT key health off a frame-count delta:
// that can momentarily read 0 on a stale stats snapshot while the feed is fine.)
export function contributionHealth({active, bitrate}) {
  if (!active) return {level: "idle", label: "IDLE", detail: "No publisher connected"};
  if (bitrate === 0) return {level: "warning", label: "STALLED", detail: "Live, but no data is arriving"};
  return {level: "healthy", label: "HEALTHY", detail: "Live"};
}

// One forward output to a destination.
//   enabled    — the destination is toggled on
//   running    — FFmpeg is up (pid > 0)
//   blocked    — another channel owns this destination target
//   speed      — parsed FFmpeg speed (× real-time), or null if not yet reported
//   sourceLive — the channel's own source is currently publishing
export function egressHealth({enabled, running, blocked, speed, sourceLive}) {
  if (blocked) return {level: "blocked", label: "BLOCKED", detail: "Another channel is streaming to this destination"};
  if (!enabled) return {level: "idle", label: "OFF", detail: "Forwarding disabled"};
  if (running) {
    if (speed != null && speed < SPEED_FLOOR) {
      return {level: "warning", label: "DEGRADED", detail: `Falling behind — speed ${speed}×`};
    }
    return {level: "healthy", label: "HEALTHY", detail: speed != null ? `Forwarding · ${speed}×` : "Forwarding"};
  }
  // Enabled but not forwarding.
  if (sourceLive) return {level: "down", label: "DOWN", detail: "Source is live but this output is not forwarding"};
  return {level: "idle", label: "WAITING", detail: "Waiting for the source to go live"};
}

const STYLES = {
  healthy: {symbol: "●", color: "#15803d", bg: "rgba(21,128,61,0.09)",  border: "rgba(21,128,61,0.30)"},
  warning: {symbol: "▲", color: "#b45309", bg: "rgba(180,83,9,0.10)",  border: "rgba(180,83,9,0.32)"},
  down:    {symbol: "■", color: "#b91c1c", bg: "#fef2f2",               border: "#fca5a5"},
  blocked: {symbol: "⊘", color: "#b54100", bg: "rgba(181,65,0,0.08)",  border: "rgba(181,65,0,0.25)"},
  idle:    {symbol: "○", color: "#6b6865", bg: "#edecea",               border: "#888582"},
};

const badgeMono = {fontFamily: "'Public Sans', sans-serif", fontVariantNumeric: "tabular-nums"};

export function HealthBadge({level, label, title}) {
  const s = STYLES[level] || STYLES.idle;
  return (
    <span
      title={title}
      role="status"
      style={{
        ...badgeMono, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
        color: s.color, background: s.bg, border: `1px solid ${s.border}`,
        padding: "2px 7px", borderRadius: 3, whiteSpace: "nowrap", lineHeight: 1.5,
      }}>
      {s.symbol} {label}
    </span>
  );
}
