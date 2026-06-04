//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
import React from "react";
import axios from "axios";
import {Link, useLocation} from "react-router-dom";
import {Token} from "../utils";
import {SrsErrorBoundary} from "../components/SrsErrorBoundary";
import {SrsEnvContext} from "../components/SrsEnvContext";
import {buildIngestUrls} from "../components/ingestUrls";

export default function Ingest() {
  return (
    <SrsErrorBoundary>
      <IngestImpl />
    </SrsErrorBoundary>
  );
}

// ── Design tokens (matches ForwardManager/Streams) ────────────────────────────
const ACCENT  = "#b54100";
const BG      = "#f5f4f1";
const CARD    = "#ffffff";
const PANEL   = "#edecea";
const BORDER  = "#888582";
const HEADING = "#111111";
const BODY    = "#2b2926";
const SECOND  = "#4a4744";
const MUTED   = "#6b6865";
const DANGER  = "#b91c1c";

const mono = {fontFamily: "'Public Sans', sans-serif", fontVariantNumeric: "tabular-nums"};
const syne = {fontFamily: "'Public Sans', sans-serif"};

const inputBase = {
  ...mono, fontSize: 13, color: BODY,
  background: CARD, border: `1.5px solid ${BORDER}`,
  borderRadius: 5, outline: "none", transition: "border-color 0.15s",
  width: "100%",
};

const STREAM_NAME_RE = /^[a-zA-Z0-9_-]+$/;

// ── Shared components ─────────────────────────────────────────────────────────
function Btn({children, onClick, variant = "primary", disabled, small, style: extra = {}}) {
  const base = {
    ...syne, fontWeight: 700, letterSpacing: "0.04em",
    borderRadius: 5, cursor: disabled ? "not-allowed" : "pointer",
    border: "1.5px solid", transition: "all 0.15s ease",
    fontSize: small ? 11 : 13,
    padding: small ? "4px 12px" : "8px 18px",
    opacity: disabled ? 0.45 : 1, lineHeight: 1.4,
  };
  const variants = {
    primary: {background: ACCENT,       color: "#ffffff", borderColor: ACCENT},
    ghost:   {background: "transparent", color: SECOND,   borderColor: BORDER},
    danger:  {background: "#fef2f2",     color: DANGER,   borderColor: "#fca5a5"},
    dim:     {background: PANEL,         color: SECOND,   borderColor: BORDER},
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{...base, ...variants[variant], ...extra}}>
      {children}
    </button>
  );
}

// A read-only field with a one-click Copy button.
function CopyField({label, value, hint}) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div style={{marginBottom: 16}}>
      <label style={{
        display: "block", ...mono, fontSize: 10, color: MUTED,
        letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7,
      }}>{label}</label>
      <div style={{display: "flex", gap: 8}}>
        <input
          readOnly
          value={value}
          onFocus={e => e.target.select()}
          style={{...inputBase, padding: "9px 12px"}}
        />
        <Btn variant={copied ? "primary" : "dim"} onClick={copy} style={{whiteSpace: "nowrap"}}>
          {copied ? "Copied ✓" : "Copy"}
        </Btn>
      </div>
      {hint && (
        <span style={{...mono, fontSize: 10, color: MUTED, marginTop: 5, display: "block"}}>{hint}</span>
      )}
    </div>
  );
}

function Section({title, children}) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
      borderLeft: `3px solid ${ACCENT}`, padding: "20px 22px", marginBottom: 16,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{...syne, fontWeight: 800, fontSize: 15, color: HEADING, marginBottom: 16}}>{title}</div>
      {children}
    </div>
  );
}

// ── Nav bar ───────────────────────────────────────────────────────────────────
const ALL_NAV_ITEMS = [
  {to: '/routers-forward',    text: 'Forward'},
  {to: '/routers-ingest',     text: 'Ingest'},
  {to: '/routers-channels',   text: 'Channels'},
  {to: '/routers-streams',    text: 'Streams'},
  {to: '/routers-scenario',   text: 'Scenario',   ownerOnly: true},
  {to: '/routers-settings',   text: 'System',     ownerOnly: true},
  {to: '/routers-components', text: 'Components', ownerOnly: true},
  {to: '/routers-contact',    text: 'Contact',    ownerOnly: true},
  {to: '/routers-users',      text: 'Users',      ownerOnly: true},
  {to: '/routers-logout',     text: 'Logout'},
];

function NavBar() {
  const location = useLocation();
  const user = Token.loadUser();
  const isOwner = !user || user.role === 'owner';
  const items = ALL_NAV_ITEMS.filter(e => !e.ownerOnly || isOwner);

  return (
    <div style={{
      background: CARD, borderBottom: `1px solid ${BORDER}`,
      padding: "0 32px", display: "flex", alignItems: "stretch",
      boxShadow: "0 1px 0 rgba(0,0,0,0.06)",
    }}>
      <nav style={{display: "flex", alignItems: "stretch", gap: 2}}>
        {items.map(item => {
          const active = location.pathname.includes(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                ...syne, fontSize: 12, fontWeight: active ? 700 : 500,
                color: active ? ACCENT : SECOND,
                textDecoration: "none",
                padding: "14px 14px 12px",
                borderBottom: active ? `2px solid ${ACCENT}` : "2px solid transparent",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = HEADING; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = SECOND; }}
            >
              {item.text}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function IngestImpl() {
  const [secret, setSecret]     = React.useState(null);
  const [loading, setLoading]   = React.useState(true);
  const [error, setError]       = React.useState(null);
  const [stream, setStream]     = React.useState("livestream");
  const [revealKey, setRevealKey] = React.useState(false);
  const env = React.useContext(SrsEnvContext)[0];

  const user = Token.loadUser();
  const isOwner = !user || user.role === 'owner';

  const loadSecret = React.useCallback(() => {
    setLoading(true);
    axios.post('/terraform/v1/hooks/srs/secret/query', {}, {headers: Token.loadBearerHeader()})
      .then(res => setSecret(res.data.data))
      .catch(e => setError(e.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { loadSecret(); }, [loadSecret]);

  const name = stream.trim() || "livestream";
  const nameValid = STREAM_NAME_RE.test(name) && name.length <= 100;
  const pub = secret?.publish || "";
  const host = window.location.hostname;
  const srtPort = env?.srtPort || "10080";

  // Optional SRT AES encryption (set server-side via SRT_PASSPHRASE).
  const srtPassphrase = secret?.srtPassphrase || "";
  const srtPbkeylen = secret?.srtPbkeylen || "16";
  const srtEncrypted = !!srtPassphrase;

  const urls = buildIngestUrls({
    host, srtPort, name, secret: pub, srtPassphrase, srtPbkeylen,
    origin: window.location.origin,
  });
  const {rtmpServer, rtmpKey, srtUrl, hlsUrl} = urls;

  const rotateSecret = async () => {
    if (!window.confirm(
      "Rotate the publish key?\n\nEvery existing ingest URL (and any encoders already configured) will STOP working until updated with the new key. Continue?"
    )) return;
    // Generate the publish secret with a CSPRNG (16 bytes -> 32 hex chars).
    const rnd = new Uint8Array(16);
    crypto.getRandomValues(rnd);
    const next = Array.from(rnd, b => b.toString(16).padStart(2, "0")).join("");
    try {
      await axios.post('/terraform/v1/hooks/srs/secret/update', {secret: next}, {headers: Token.loadBearerHeader()});
      loadSecret();
    } catch (e) {
      alert("Rotate failed: " + (e.response?.data?.message || e.message));
    }
  };

  return (
    <div style={{background: BG, color: BODY, ...syne, minHeight: "100vh"}}>
      <NavBar/>

      <main style={{padding: "28px 32px", maxWidth: 820, margin: "0 auto"}}>
        <div style={{...syne, fontWeight: 800, fontSize: 20, color: HEADING, marginBottom: 4}}>
          Ingest / Publish
        </div>
        <div style={{fontSize: 13, color: MUTED, marginBottom: 24}}>
          Point your encoder (OBS, vMix, hardware) at one of these URLs to start streaming.
          Then watch it appear under <Link to="/routers-streams" style={{color: ACCENT}}>Streams</Link> and
          fan it out under <Link to="/routers-forward" style={{color: ACCENT}}>Forward</Link>.
        </div>

        {loading ? (
          <div role="status" style={{textAlign: "center", padding: 72, ...mono, fontSize: 12, color: MUTED, letterSpacing: "0.15em"}}>LOADING…</div>
        ) : error ? (
          <div role="alert" style={{background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 28, textAlign: "center"}}>
            <div style={{...mono, fontSize: 13, color: DANGER, marginBottom: 10}}>⚠ {error}</div>
            <Btn variant="primary" onClick={loadSecret}>Retry</Btn>
          </div>
        ) : (
          <>
            {/* Stream name */}
            <Section title="Stream name">
              <input
                value={stream}
                onChange={e => setStream(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                style={{...inputBase, padding: "9px 12px", borderColor: nameValid ? BORDER : DANGER, maxWidth: 320}}
                onFocus={e => (e.target.style.borderColor = nameValid ? ACCENT : DANGER)}
                onBlur={e  => (e.target.style.borderColor = nameValid ? BORDER : DANGER)}
              />
              <span style={{...mono, fontSize: 10, color: nameValid ? MUTED : DANGER, marginTop: 6, display: "block"}}>
                {nameValid
                  ? "Letters, numbers, hyphens and underscores. Each distinct name is a separate stream."
                  : "Invalid: use only letters, numbers, hyphens and underscores (max 100)."}
              </span>
            </Section>

            {/* RTMP */}
            <Section title="RTMP">
              <CopyField label="Server" value={rtmpServer} hint="In OBS: Settings → Stream → Service: Custom → paste as Server." />
              <CopyField label="Stream Key" value={rtmpKey} hint="Paste as Stream Key (includes the publish secret)." />
            </Section>

            {/* SRT */}
            <Section title={srtEncrypted ? `SRT  ·  encrypted (AES-${{16:128,24:192,32:256}[srtPbkeylen] || srtPbkeylen})` : "SRT"}>
              <CopyField
                label="Publish URL"
                value={srtUrl}
                hint={srtEncrypted
                  ? "OBS / single-URL clients: paste the whole URL as Server (it includes the passphrase). Hardware encoders (Teradek, Haivision): use the fields below instead."
                  : "In OBS: Service: Custom → paste the whole URL as Server, leave Stream Key blank. Tuned latency/buffer params are included for lossy networks."}
              />
              {srtEncrypted ? (
                <>
                  <CopyField label="Stream ID" value={urls.srtStreamId} hint="Hardware encoders: paste into the SRT Stream ID field." />
                  <CopyField
                    label={`Passphrase (AES-${{16:128,24:192,32:256}[srtPbkeylen] || srtPbkeylen})`}
                    value={srtPassphrase}
                    hint="Hardware encoders: enter in the SRT Passphrase / Encryption field — NOT a place for the stream key. Address: this host, Port: 10080, Mode: Caller."
                  />
                </>
              ) : (
                <span style={{...mono, fontSize: 11, color: MUTED, display: "block"}}>
                  SRT encryption is <b>off</b> — publishing is authorized by the stream key only.
                  To require AES encryption, set <code>SRT_PASSPHRASE</code> on the server.
                </span>
              )}
            </Section>

            {/* Playback */}
            <Section title="Playback (verify)">
              <CopyField label="HLS (.m3u8)" value={hlsUrl} hint="Open in a player once you're publishing to confirm the stream is live." />
            </Section>

            {/* Publish key */}
            <Section title="Publish key">
              {pub ? (
                <CopyField
                  label="Secret"
                  value={revealKey ? pub : "•".repeat(Math.min(pub.length, 24))}
                  hint="This key authorizes publishing and is embedded in the URLs above."
                />
              ) : (
                <div style={{...mono, fontSize: 12, color: MUTED, marginBottom: 12}}>
                  Publishing currently requires no key (auth disabled).
                </div>
              )}
              <div style={{display: "flex", gap: 10}}>
                {pub && (
                  <Btn variant="ghost" small onClick={() => setRevealKey(v => !v)}>
                    {revealKey ? "Hide key" : "Reveal key"}
                  </Btn>
                )}
                {isOwner && (
                  <Btn variant="danger" small onClick={rotateSecret}>Rotate key</Btn>
                )}
              </div>
              {isOwner && (
                <span style={{...mono, fontSize: 10, color: MUTED, marginTop: 8, display: "block"}}>
                  Rotating generates a new key and invalidates all current ingest URLs — only do this if a key leaked.
                </span>
              )}
            </Section>

            {/* Encoder tips */}
            <Section title="Recommended encoder settings">
              <ul style={{...mono, fontSize: 12, color: SECOND, lineHeight: 1.9, margin: 0, paddingLeft: 18}}>
                <li>Codec <b>H.264</b>, rate control <b>CBR</b>.</li>
                <li><b>Keyframe interval 2s</b> — required, or YouTube sits on "Preparing".</li>
                <li>SRT: use the URL above as-is (it carries <code>latency=1000</code>, <code>pkt_size=1316</code>, <code>rcvbuf=8&nbsp;MB</code>) — prevents macroblocking on lossy uplinks.</li>
                <li>Then add YouTube/Facebook/etc. destinations under <Link to="/routers-forward" style={{color: ACCENT}}>Forward</Link>.</li>
              </ul>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
