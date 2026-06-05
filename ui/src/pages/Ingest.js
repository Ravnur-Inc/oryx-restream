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
import {useToast, apiError} from "../components/useToast";

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
  {to: '/routers-ingest',     text: 'Ingest'},
  {to: '/routers-channels',   text: 'Channels'},
  {to: '/routers-destinations', text: 'Destinations'},
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
  const [revealKey, setRevealKey] = React.useState(false);
  const {showError, Toaster} = useToast();

  const user = Token.loadUser();
  const isOwner = !user || user.role === 'owner';

  const loadSecret = React.useCallback(() => {
    setLoading(true);
    axios.post('/terraform/v1/hooks/srs/secret/query', {}, {headers: Token.loadBearerHeader()})
      .then(res => setSecret(res.data.data))
      .catch(e => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { loadSecret(); }, [loadSecret]);

  const pub = secret?.publish || "";
  // Optional SRT AES encryption (set server-side via SRT_PASSPHRASE).
  const srtPassphrase = secret?.srtPassphrase || "";
  const srtPbkeylen = secret?.srtPbkeylen || "16";
  const srtEncrypted = !!srtPassphrase;
  const aes = {16: 128, 24: 192, 32: 256}[srtPbkeylen] || srtPbkeylen;

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
      showError(e);
    }
  };

  return (
    <div style={{background: BG, color: BODY, ...syne, minHeight: "100vh"}}>
      {Toaster}
      <NavBar/>

      <main style={{padding: "28px 32px", maxWidth: 820, margin: "0 auto"}}>
        <div style={{...syne, fontWeight: 800, fontSize: 20, color: HEADING, marginBottom: 4}}>
          Publish settings
        </div>
        <div style={{fontSize: 13, color: MUTED, marginBottom: 24}}>
          The shared publish key and encoder reference for pushing streams in.
          To get a <b>ready-to-copy ingest URL</b>, open the
          {" "}<Link to="/routers-channels" style={{color: ACCENT}}>Channel</Link> you're
          publishing to → <b>Ingest URLs</b>. Confirm a live stream under
          {" "}<Link to="/routers-streams" style={{color: ACCENT}}>Streams</Link>.
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
            {/* Publish key */}
            <Section title="Publish key">
              {pub ? (
                <CopyField
                  label="Secret"
                  value={revealKey ? pub : "•".repeat(Math.min(pub.length, 24))}
                  hint="A single shared key that authorizes publishing. It's embedded in every channel's ingest URLs."
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

            {/* SRT encryption */}
            <Section title={srtEncrypted ? `SRT encryption · AES-${aes}` : "SRT encryption"}>
              {srtEncrypted ? (
                <>
                  <CopyField
                    label={`Passphrase (AES-${aes})`}
                    value={srtPassphrase}
                    hint="Enter in your encoder's SRT Passphrase / Encryption field — not the stream key. OBS includes it automatically in the channel's SRT URL."
                  />
                  <span style={{...mono, fontSize: 11, color: MUTED, display: "block"}}>
                    SRT encryption is <b>on</b>. Every SRT publisher must use this passphrase.
                  </span>
                </>
              ) : (
                <span style={{...mono, fontSize: 11, color: MUTED, display: "block"}}>
                  SRT encryption is <b>off</b> — publishing is authorized by the stream key only.
                  To require AES, set <code>SRT_PASSPHRASE</code> on the server.
                </span>
              )}
            </Section>

            {/* Encoder reference */}
            <Section title="Recommended encoder settings">
              <ul style={{...mono, fontSize: 12, color: SECOND, lineHeight: 1.9, margin: 0, paddingLeft: 18}}>
                <li>Codec <b>H.264</b>, rate control <b>CBR</b>.</li>
                <li><b>Keyframe interval 2s</b> — required, or YouTube sits on "Preparing".</li>
                <li>Get the actual <b>RTMP/SRT URL</b> from the
                  {" "}<Link to="/routers-channels" style={{color: ACCENT}}>Channel</Link> you publish to
                  (its <b>Ingest URLs</b>). The SRT URL carries tuned
                  {" "}<code>latency=1000</code>, <code>pkt_size=1316</code>, <code>rcvbuf=8&nbsp;MB</code>
                  {" "}to prevent macroblocking on lossy uplinks.</li>
                <li><b>Hardware (Teradek/Haivision) SRT:</b> Mode Caller, this host, port
                  {" "}<code>10080</code>, Stream ID from the channel{srtEncrypted ? ", Passphrase above" : ""}.</li>
              </ul>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
