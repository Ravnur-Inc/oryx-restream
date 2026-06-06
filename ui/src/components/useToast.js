//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
// Shared, in-page error/notice handling for the Ravnur UI. Replaces browser
// alert() with a descriptive, dismissible toast, and extracts the real backend
// message regardless of envelope (plain-text body on HTTP errors, or the oryx
// {code, data} JSON envelope).
import React from "react";

// Theme-aware tokens (adapt to light/dark via Mantine CSS variables).
const ACCENT = "var(--mantine-primary-color-filled)";
const CARD = "var(--mantine-color-body)";
const BORDER = "var(--mantine-color-default-border)";
const DANGER = "var(--mantine-color-red-6)";
const TEXT = "var(--mantine-color-text)";
const MUTED = "var(--mantine-color-dimmed)";
const mono = {fontFamily: "'Public Sans', sans-serif"};

// Extract the most descriptive message from an axios error (or a plain string).
export function apiError(e) {
  if (typeof e === "string") return e;
  const d = e?.response?.data;
  if (typeof d === "string" && d.trim()) return d.trim();
  if (d && typeof d === "object") {
    if (typeof d.data === "string" && d.data.trim()) return d.data.trim();
    if (typeof d.message === "string" && d.message.trim()) return d.message.trim();
  }
  return e?.message || "Request failed";
}

// useToast returns helpers and a <Toaster/> element to render once per screen.
export function useToast() {
  const [toast, setToast] = React.useState(null); // {type: 'error'|'ok', msg}
  const timer = React.useRef();

  const show = React.useCallback((type, msg) => {
    setToast({type, msg});
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), type === "error" ? 9000 : 4000);
  }, []);

  const showError = React.useCallback((e) => show("error", apiError(e)), [show]);
  const showOk = React.useCallback((msg) => show("ok", msg), [show]);
  const dismiss = React.useCallback(() => setToast(null), []);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const Toaster = toast ? (
    <div role={toast.type === "error" ? "alert" : "status"} aria-live="assertive"
      style={{
        position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 1000, maxWidth: "min(720px, 92vw)",
        display: "flex", alignItems: "flex-start", gap: 12,
        background: CARD, color: TEXT,
        border: `1.5px solid ${toast.type === "error" ? "var(--mantine-color-red-4)" : BORDER}`,
        borderLeft: `4px solid ${toast.type === "error" ? DANGER : ACCENT}`,
        borderRadius: 8, padding: "12px 14px",
        boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
      }}>
      <span aria-hidden="true" style={{...mono, fontSize: 14, color: toast.type === "error" ? DANGER : ACCENT, lineHeight: 1.4}}>
        {toast.type === "error" ? "⚠" : "✓"}
      </span>
      <span style={{...mono, fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", flex: 1}}>
        {toast.msg}
      </span>
      <button onClick={dismiss} aria-label="Dismiss"
        style={{background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 2px"}}>✕</button>
    </div>
  ) : null;

  return {showError, showOk, dismiss, Toaster};
}
