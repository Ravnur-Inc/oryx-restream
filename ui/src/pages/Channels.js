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

export default function Channels() {
  return (
    <SrsErrorBoundary>
      <ChannelsImpl />
    </SrsErrorBoundary>
  );
}

// ── Design tokens (matches the other screens) ─────────────────────────────────
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

const NAME_RE = /^[a-zA-Z0-9_-]+$/;

// ── Shared bits ───────────────────────────────────────────────────────────────
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

function CopyField({label, value}) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = value; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div style={{marginBottom: 10}}>
      <label style={{display: "block", ...mono, fontSize: 10, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5}}>{label}</label>
      <div style={{display: "flex", gap: 8}}>
        <input readOnly value={value} onFocus={e => e.target.select()} style={{...inputBase, padding: "7px 10px"}}/>
        <Btn variant={copied ? "primary" : "dim"} small onClick={copy} style={{whiteSpace: "nowrap"}}>{copied ? "Copied ✓" : "Copy"}</Btn>
      </div>
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

function NavBar({onAdd}) {
  const location = useLocation();
  const user = Token.loadUser();
  const isOwner = !user || user.role === 'owner';
  const items = ALL_NAV_ITEMS.filter(e => !e.ownerOnly || isOwner);
  return (
    <div style={{background: CARD, borderBottom: `1px solid ${BORDER}`, padding: "0 32px", display: "flex", alignItems: "stretch", justifyContent: "space-between", boxShadow: "0 1px 0 rgba(0,0,0,0.06)"}}>
      <nav style={{display: "flex", alignItems: "stretch", gap: 2}}>
        {items.map(item => {
          const active = location.pathname.includes(item.to);
          return (
            <Link key={item.to} to={item.to} style={{
              ...syne, fontSize: 12, fontWeight: active ? 700 : 500,
              color: active ? ACCENT : SECOND, textDecoration: "none",
              padding: "14px 14px 12px",
              borderBottom: active ? `2px solid ${ACCENT}` : "2px solid transparent",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = HEADING; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = SECOND; }}
            >{item.text}</Link>
          );
        })}
      </nav>
      <div style={{display: "flex", alignItems: "center", paddingLeft: 16}}>
        <Btn variant="primary" onClick={onAdd}>+ Add Channel</Btn>
      </div>
    </div>
  );
}

// ── Channel card ──────────────────────────────────────────────────────────────
function ChannelCard({channel, urls, bound, onEdit, onDelete}) {
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [showUrls, setShowUrls] = React.useState(false);

  return (
    <article style={{
      background: CARD, borderRadius: 8, padding: "18px 22px",
      border: `1px solid ${BORDER}`, borderLeft: `3px solid ${ACCENT}`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12}}>
        <div style={{minWidth: 0, flex: 1}}>
          <div style={{...syne, fontWeight: 700, fontSize: 14, color: HEADING, marginBottom: 2}}>{channel.label}</div>
          {channel.description && (
            <div style={{...mono, fontSize: 11, color: MUTED, marginBottom: 4}}>{channel.description}</div>
          )}
          <div style={{display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4}}>
            <span style={{...mono, fontSize: 10, color: MUTED}}>STREAM <span style={{color: SECOND}}>{channel.name}</span></span>
            <span style={{...mono, fontSize: 10, color: MUTED}}>
              DESTINATIONS <span style={{color: bound.length ? ACCENT : SECOND}}>{bound.length}</span>
              {bound.length > 0 && <span style={{color: SECOND}}> · {bound.map(b => b.label || b.platform).join(", ")}</span>}
            </span>
          </div>
        </div>
        <div style={{display: "flex", alignItems: "center", gap: 8, flexShrink: 0}}>
          <Btn variant="dim" small onClick={() => setShowUrls(s => !s)}>{showUrls ? "Hide URLs" : "Ingest URLs"}</Btn>
          <button onClick={() => onEdit(channel)} aria-label={`Edit ${channel.label}`} style={iconBtn}
            onMouseEnter={e => {e.currentTarget.style.color = HEADING; e.currentTarget.style.background = PANEL; e.currentTarget.style.borderColor = BORDER;}}
            onMouseLeave={e => {e.currentTarget.style.color = SECOND; e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "transparent";}}
          >✎</button>
          <button onClick={() => setConfirmDel(true)} aria-label={`Delete ${channel.label}`} style={iconBtn}
            onMouseEnter={e => {e.currentTarget.style.color = DANGER; e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = "#fca5a5";}}
            onMouseLeave={e => {e.currentTarget.style.color = SECOND; e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "transparent";}}
          >✕</button>
        </div>
      </div>

      {showUrls && (
        <div style={{marginTop: 14, paddingTop: 14, borderTop: `1px solid ${PANEL}`}}>
          <CopyField label="RTMP server" value={urls.rtmpServer}/>
          <CopyField label="RTMP stream key" value={urls.rtmpKey}/>
          <CopyField label={urls.encrypted ? "SRT URL (encrypted)" : "SRT URL"} value={urls.srtUrl}/>
          <CopyField label="HLS playback" value={urls.hlsUrl}/>
          <div style={{...mono, fontSize: 10, color: MUTED, marginTop: 2}}>
            Same shared publish key as the <Link to="/routers-ingest" style={{color: ACCENT}}>Ingest</Link> page; bind destinations to this channel by setting their Source Stream Name to <b>{channel.name}</b> in <Link to="/routers-forward" style={{color: ACCENT}}>Forward</Link>.
          </div>
        </div>
      )}

      {confirmDel && (
        <div role="alertdialog" aria-label="Confirm deletion" style={{marginTop: 14, padding: "14px 16px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fca5a5"}}>
          <div style={{...syne, fontSize: 13, color: DANGER, marginBottom: 10}}>
            Delete channel "{channel.label}"? This only removes the saved channel — it does not stop any streams or destinations.
          </div>
          <div style={{display: "flex", gap: 8}}>
            <Btn variant="ghost" small onClick={() => setConfirmDel(false)}>Cancel</Btn>
            <Btn variant="danger" small onClick={() => {setConfirmDel(false); onDelete(channel);}}>Delete</Btn>
          </div>
        </div>
      )}
    </article>
  );
}

const iconBtn = {
  background: "none", border: "1px solid transparent", color: SECOND,
  cursor: "pointer", fontSize: 15, padding: "3px 6px", lineHeight: 1,
  borderRadius: 4, transition: "all 0.15s",
};

// ── Add / Edit modal ──────────────────────────────────────────────────────────
function ChannelModal({initial, onSave, onClose, saving}) {
  const [form, setForm] = React.useState(initial
    ? {label: initial.label || "", name: initial.name || "", description: initial.description || ""}
    : {label: "", name: "", description: ""});
  const set = (k) => (e) => setForm(f => ({...f, [k]: e.target.value}));
  const nameValid = NAME_RE.test(form.name.trim()) && form.name.trim().length <= 100;
  const valid = form.label.trim() && form.name.trim() && nameValid;

  React.useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={initial ? "Edit channel" : "New channel"}
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{position: "fixed", inset: 0, background: "rgba(43,41,38,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)"}}>
      <div style={{background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "32px 36px", width: 500, maxWidth: "92vw", boxShadow: "0 24px 60px rgba(0,0,0,0.18)"}}>
        <div style={{display: "flex", alignItems: "center", gap: 12, marginBottom: 28}}>
          <div style={{width: 5, height: 28, background: ACCENT, borderRadius: 3}}/>
          <span style={{...syne, fontWeight: 800, fontSize: 18, color: HEADING}}>{initial ? "Edit Channel" : "New Channel"}</span>
        </div>

        <div style={{marginBottom: 18}}>
          <label htmlFor="ch-label" style={lbl}>Channel Label</label>
          <input id="ch-label" type="text" style={{...inputBase, padding: "9px 12px"}} placeholder="e.g. Sunday Service" value={form.label} onChange={set("label")}
            onFocus={e => (e.target.style.borderColor = ACCENT)} onBlur={e => (e.target.style.borderColor = BORDER)}/>
        </div>

        <div style={{marginBottom: 18}}>
          <label htmlFor="ch-name" style={lbl}>Stream Name</label>
          <input id="ch-name" type="text" spellCheck={false} autoComplete="off" maxLength={100}
            style={{...inputBase, padding: "9px 12px", borderColor: (!form.name || nameValid) ? BORDER : DANGER}}
            placeholder="e.g. sunday-service" value={form.name} onChange={set("name")}
            onFocus={e => (e.target.style.borderColor = (!form.name || nameValid) ? ACCENT : DANGER)}
            onBlur={e => (e.target.style.borderColor = (!form.name || nameValid) ? BORDER : DANGER)}/>
          <span style={{...mono, fontSize: 10, color: (!form.name || nameValid) ? MUTED : DANGER, marginTop: 5, display: "block"}}>
            The publish stream name (letters, numbers, hyphens, underscores). This is what makes the ingest URL and binds Forward destinations.
          </span>
        </div>

        <div style={{marginBottom: 28}}>
          <label htmlFor="ch-desc" style={lbl}>Description <span style={{fontWeight: 400, textTransform: "none", letterSpacing: 0}}>— optional</span></label>
          <input id="ch-desc" type="text" style={{...inputBase, padding: "9px 12px"}} placeholder="e.g. Main auditorium camera" value={form.description} onChange={set("description")}
            onFocus={e => (e.target.style.borderColor = ACCENT)} onBlur={e => (e.target.style.borderColor = BORDER)}/>
        </div>

        <div style={{display: "flex", gap: 10, justifyContent: "flex-end"}}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!valid || saving} onClick={() => valid && onSave({...form, id: initial?.id})}>
            {saving ? "Saving…" : "Save Channel"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

const lbl = {display: "block", ...mono, fontSize: 10, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7};

// ── Main ──────────────────────────────────────────────────────────────────────
function ChannelsImpl() {
  const [channels, setChannels] = React.useState([]);
  const [secret, setSecret]     = React.useState(null);
  const [forwards, setForwards] = React.useState({});
  const [loading, setLoading]   = React.useState(true);
  const [error, setError]       = React.useState(null);
  const [modal, setModal]       = React.useState(null);
  const [saving, setSaving]     = React.useState(false);
  const env = React.useContext(SrsEnvContext)[0];

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const hdr = {headers: Token.loadBearerHeader()};
      const [chRes, secRes, fwRes] = await Promise.all([
        axios.post('/terraform/v1/mgmt/channels', {}, hdr),
        axios.post('/terraform/v1/hooks/srs/secret/query', {}, hdr),
        axios.post('/terraform/v1/ffmpeg/forward/secret', {}, hdr),
      ]);
      setChannels(chRes.data.data || []);
      setSecret(secRes.data.data || {});
      setForwards(fwRes.data.data || {});
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      await axios.post('/terraform/v1/mgmt/channels', {
        action: form.id ? 'update' : 'create',
        ...(form.id ? {id: form.id} : {}),
        label: form.label.trim(), name: form.name.trim(), description: form.description.trim(),
      }, {headers: Token.loadBearerHeader()});
      setModal(null);
      await load();
    } catch (e) {
      alert("Save failed: " + (e.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (channel) => {
    try {
      await axios.post('/terraform/v1/mgmt/channels', {action: 'delete', id: channel.id}, {headers: Token.loadBearerHeader()});
      await load();
    } catch (e) {
      alert("Delete failed: " + (e.response?.data?.message || e.message));
    }
  };

  const host = window.location.hostname;
  const srtPort = env?.srtPort || "10080";
  const pub = secret?.publish || "";
  const srtPassphrase = secret?.srtPassphrase || "";
  const srtPbkeylen = secret?.srtPbkeylen || "16";

  // Forward destinations bound to a channel = those whose source stream matches the channel name.
  const boundFor = (name) => Object.values(forwards).filter(f => f.stream && f.stream === name);

  return (
    <div style={{background: BG, color: BODY, ...syne, minHeight: "100vh"}}>
      <NavBar onAdd={() => setModal({mode: "add"})}/>

      <main style={{padding: "28px 32px", maxWidth: 820, margin: "0 auto"}}>
        <div style={{...syne, fontWeight: 800, fontSize: 20, color: HEADING, marginBottom: 4}}>Channels</div>
        <div style={{fontSize: 13, color: MUTED, marginBottom: 24}}>
          Saved, named ingests you can reuse. Each channel has a stable stream name, so its
          <Link to="/routers-ingest" style={{color: ACCENT}}> Ingest</Link> URLs and
          <Link to="/routers-forward" style={{color: ACCENT}}> Forward</Link> bindings stay consistent across repeat streams.
        </div>

        {loading ? (
          <div role="status" style={{textAlign: "center", padding: 72, ...mono, fontSize: 12, color: MUTED, letterSpacing: "0.15em"}}>LOADING…</div>
        ) : error ? (
          <div role="alert" style={{background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 28, textAlign: "center"}}>
            <div style={{...mono, fontSize: 13, color: DANGER, marginBottom: 10}}>⚠ {error}</div>
            <Btn variant="primary" onClick={load}>Retry</Btn>
          </div>
        ) : channels.length === 0 ? (
          <div style={{textAlign: "center", padding: "56px 24px"}}>
            <div aria-hidden="true" style={{fontSize: 40, marginBottom: 14, color: BORDER}}>⬡</div>
            <div style={{...syne, fontSize: 15, color: SECOND, marginBottom: 6}}>No channels yet</div>
            <div style={{fontSize: 12, color: MUTED, marginBottom: 20}}>Save a named ingest to reuse it across streams</div>
            <Btn variant="primary" onClick={() => setModal({mode: "add"})}>+ Add Channel</Btn>
          </div>
        ) : (
          <div style={{display: "flex", flexDirection: "column", gap: 10}}>
            {channels.map(channel => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                bound={boundFor(channel.name)}
                urls={buildIngestUrls({host, srtPort, name: channel.name, secret: pub, srtPassphrase, srtPbkeylen, origin: window.location.origin})}
                onEdit={(c) => setModal({mode: "edit", channel: c})}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {modal && (
        <ChannelModal
          initial={modal.channel}
          saving={saving}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
