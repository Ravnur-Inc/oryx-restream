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

export default function Destinations() {
  return (
    <SrsErrorBoundary>
      <DestinationsImpl />
    </SrsErrorBoundary>
  );
}

async function apiPost(path, body = {}) {
  const res = await axios.post(path, body, {headers: Token.loadBearerHeader()});
  if (res.data.code !== 0) throw new Error(res.data.message || `API error code ${res.data.code}`);
  return res.data;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT="#b54100", BG="#f5f4f1", CARD="#fff", PANEL="#edecea", BORDER="#888582",
  HEADING="#111", BODY="#2b2926", SECOND="#4a4744", MUTED="#6b6865", DANGER="#b91c1c";
const mono = {fontFamily: "'Public Sans', sans-serif", fontVariantNumeric: "tabular-nums"};
const syne = {fontFamily: "'Public Sans', sans-serif"};
const inputBase = {...mono, fontSize: 13, color: BODY, background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 5, outline: "none", transition: "border-color 0.15s", width: "100%"};
const lbl = {display: "block", ...mono, fontSize: 10, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7};
const iconBtn = {background: "none", border: "1px solid transparent", color: SECOND, cursor: "pointer", fontSize: 15, padding: "3px 6px", lineHeight: 1, borderRadius: 4, transition: "all 0.15s"};

function Btn({children, onClick, variant = "primary", disabled, small, style: extra = {}}) {
  const base = {...syne, fontWeight: 700, letterSpacing: "0.04em", borderRadius: 5, cursor: disabled ? "not-allowed" : "pointer", border: "1.5px solid", transition: "all 0.15s ease", fontSize: small ? 11 : 13, padding: small ? "4px 12px" : "8px 18px", opacity: disabled ? 0.45 : 1, lineHeight: 1.4};
  const variants = {
    primary: {background: ACCENT, color: "#fff", borderColor: ACCENT},
    ghost: {background: "transparent", color: SECOND, borderColor: BORDER},
    danger: {background: "#fef2f2", color: DANGER, borderColor: "#fca5a5"},
    dim: {background: PANEL, color: SECOND, borderColor: BORDER},
  };
  return <button onClick={disabled ? undefined : onClick} style={{...base, ...variants[variant], ...extra}}>{children}</button>;
}

// ── Nav ───────────────────────────────────────────────────────────────────────
const ALL_NAV_ITEMS = [
  {to: '/routers-forward', text: 'Forward'},
  {to: '/routers-ingest', text: 'Ingest'},
  {to: '/routers-channels', text: 'Channels'},
  {to: '/routers-destinations', text: 'Destinations'},
  {to: '/routers-streams', text: 'Streams'},
  {to: '/routers-scenario', text: 'Scenario', ownerOnly: true},
  {to: '/routers-settings', text: 'System', ownerOnly: true},
  {to: '/routers-components', text: 'Components', ownerOnly: true},
  {to: '/routers-contact', text: 'Contact', ownerOnly: true},
  {to: '/routers-users', text: 'Users', ownerOnly: true},
  {to: '/routers-logout', text: 'Logout'},
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
          return <Link key={item.to} to={item.to} style={{...syne, fontSize: 12, fontWeight: active ? 700 : 500, color: active ? ACCENT : SECOND, textDecoration: "none", padding: "14px 14px 12px", borderBottom: active ? `2px solid ${ACCENT}` : "2px solid transparent", transition: "all 0.15s", whiteSpace: "nowrap"}}
            onMouseEnter={e => { if (!active) e.currentTarget.style.color = HEADING; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.color = SECOND; }}>{item.text}</Link>;
        })}
      </nav>
      <div style={{display: "flex", alignItems: "center", paddingLeft: 16}}>
        <Btn variant="primary" onClick={onAdd}>+ Add Destination</Btn>
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function DestCard({dest, attachedTo, onEdit, onDelete}) {
  const [confirmDel, setConfirmDel] = React.useState(false);
  const attached = attachedTo.length > 0;
  return (
    <article style={{background: CARD, borderRadius: 8, padding: "18px 22px", border: `1px solid ${BORDER}`, borderLeft: `3px solid ${attached ? ACCENT : "#c8c4be"}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)"}}>
      <div style={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12}}>
        <div style={{minWidth: 0, flex: 1}}>
          <div style={{...syne, fontWeight: 700, fontSize: 14, color: HEADING, marginBottom: 2}}>{dest.label}</div>
          <div style={{...mono, fontSize: 11, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{dest.server}</div>
          <div style={{display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4}}>
            <span style={{...mono, fontSize: 10, color: MUTED}}>KEY <span style={{color: SECOND}}>{dest.secret ? dest.secret.slice(0, 6) + "•••" : "(none)"}</span></span>
            <span style={{...mono, fontSize: 10, color: MUTED}}>
              {attached
                ? <>ATTACHED <span style={{color: ACCENT}}>{attachedTo.join(", ")}</span></>
                : <span style={{color: SECOND}}>not attached</span>}
            </span>
          </div>
        </div>
        <div style={{display: "flex", alignItems: "center", gap: 8, flexShrink: 0}}>
          <button onClick={() => onEdit(dest)} aria-label="Edit" style={iconBtn}
            onMouseEnter={e => {e.currentTarget.style.color = HEADING; e.currentTarget.style.background = PANEL;}}
            onMouseLeave={e => {e.currentTarget.style.color = SECOND; e.currentTarget.style.background = "none";}}>✎</button>
          <button onClick={() => setConfirmDel(true)} aria-label="Delete" style={iconBtn}
            onMouseEnter={e => {e.currentTarget.style.color = DANGER; e.currentTarget.style.background = "#fef2f2";}}
            onMouseLeave={e => {e.currentTarget.style.color = SECOND; e.currentTarget.style.background = "none";}}>✕</button>
        </div>
      </div>
      {confirmDel && (
        <div role="alertdialog" style={{marginTop: 14, padding: "14px 16px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fca5a5"}}>
          <div style={{...syne, fontSize: 13, color: DANGER, marginBottom: 10}}>
            {attached
              ? <>This destination is attached to {attachedTo.join(", ")}. Detach it in those channels first.</>
              : <>Delete destination "{dest.label}"?</>}
          </div>
          <div style={{display: "flex", gap: 8}}>
            <Btn variant="ghost" small onClick={() => setConfirmDel(false)}>Cancel</Btn>
            {!attached && <Btn variant="danger" small onClick={() => {setConfirmDel(false); onDelete(dest);}}>Delete</Btn>}
          </div>
        </div>
      )}
    </article>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function DestModal({initial, onSave, onClose, saving}) {
  const [form, setForm] = React.useState(initial
    ? {label: initial.label || "", server: initial.server || "", secret: initial.secret || ""}
    : {label: "", server: "", secret: ""});
  const set = (k) => (e) => setForm(f => ({...f, [k]: e.target.value}));
  const valid = form.label.trim() && form.server.trim();
  React.useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const field = (id, label, ph, key) => (
    <div style={{marginBottom: 18}}>
      <label htmlFor={id} style={lbl}>{label}</label>
      <input id={id} type="text" style={{...inputBase, padding: "9px 12px"}} placeholder={ph} value={form[key]} onChange={set(key)}
        onFocus={e => (e.target.style.borderColor = ACCENT)} onBlur={e => (e.target.style.borderColor = BORDER)}/>
    </div>
  );
  return (
    <div role="dialog" aria-modal="true" aria-label={initial ? "Edit destination" : "New destination"} onClick={e => e.target === e.currentTarget && onClose()}
      style={{position: "fixed", inset: 0, background: "rgba(43,41,38,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)"}}>
      <div style={{background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "32px 36px", width: 500, maxWidth: "92vw", boxShadow: "0 24px 60px rgba(0,0,0,0.18)"}}>
        <div style={{display: "flex", alignItems: "center", gap: 12, marginBottom: 24}}>
          <div style={{width: 5, height: 28, background: ACCENT, borderRadius: 3}}/>
          <span style={{...syne, fontWeight: 800, fontSize: 18, color: HEADING}}>{initial ? "Edit Destination" : "New Destination"}</span>
        </div>
        {field("dl-label", "Label", "e.g. YouTube — Main Channel", "label")}
        {field("dl-server", "RTMP Server URL", "rtmp://a.rtmp.youtube.com/live2", "server")}
        {field("dl-secret", "Stream Key / Secret", "xxxx-xxxx-xxxx-xxxx", "secret")}
        {initial && (
          <div style={{...mono, fontSize: 10, color: MUTED, marginBottom: 18}}>
            Editing applies to wherever this destination is currently attached (its live forward restarts).
          </div>
        )}
        <div style={{display: "flex", gap: 10, justifyContent: "flex-end"}}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!valid || saving} onClick={() => valid && onSave({...form, id: initial?.id})}>{saving ? "Saving…" : "Save Destination"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function DestinationsImpl() {
  const [dests, setDests] = React.useState([]);
  const [forwards, setForwards] = React.useState({});
  const [channels, setChannels] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [modal, setModal] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const {showError, Toaster} = useToast();

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [d, f, c] = await Promise.all([
        apiPost('/terraform/v1/mgmt/destinations'),
        apiPost('/terraform/v1/ffmpeg/forward/secret'),
        apiPost('/terraform/v1/mgmt/channels'),
      ]);
      setDests(d.data || []);
      setForwards(f.data || {});
      setChannels(c.data || []);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const channelByStream = React.useMemo(() => Object.fromEntries((channels || []).map(c => [c.name, c.label])), [channels]);
  // destinationId -> [channel labels / stream names] it is attached to
  const attachMap = React.useMemo(() => {
    const m = {};
    Object.values(forwards).forEach(f => {
      if (!f.destinationId) return;
      const where = channelByStream[f.stream] || f.stream || "(unbound)";
      (m[f.destinationId] = m[f.destinationId] || []).push(where);
    });
    return m;
  }, [forwards, channelByStream]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      await apiPost('/terraform/v1/mgmt/destinations', {
        action: form.id ? 'update' : 'create', ...(form.id ? {id: form.id} : {}),
        label: form.label.trim(), server: form.server.trim(), secret: form.secret.trim(),
      });
      setModal(null); await load();
    } catch (e) { showError(e); }
    finally { setSaving(false); }
  };
  const handleDelete = async (dest) => {
    try { await apiPost('/terraform/v1/mgmt/destinations', {action: 'delete', id: dest.id}); await load(); }
    catch (e) { showError(e); }
  };

  const owners = dests.length;
  const attachedCount = dests.filter(d => (attachMap[d.id] || []).length > 0).length;

  return (
    <div style={{background: BG, color: BODY, ...syne, minHeight: "100vh"}}>
      {Toaster}
      <NavBar onAdd={() => setModal({mode: "add"})}/>

      <div style={{background: CARD, borderBottom: `1px solid ${BORDER}`, padding: "9px 32px", display: "flex", gap: 28}}>
        {[["DESTINATIONS", owners], ["ATTACHED", attachedCount], ["UNUSED", owners - attachedCount]].map(([k, v]) => (
          <div key={k} style={{display: "flex", alignItems: "center", gap: 7}}>
            <span style={{...mono, fontSize: 10, color: MUTED, letterSpacing: "0.1em"}}>{k}</span>
            <span style={{...mono, fontSize: 15, fontWeight: 600, color: v > 0 ? ACCENT : SECOND}}>{v}</span>
          </div>
        ))}
      </div>

      <main style={{padding: "28px 32px", maxWidth: 820, margin: "0 auto"}}>
        <div style={{fontSize: 13, color: MUTED, marginBottom: 24}}>
          A reusable library of forward targets (YouTube, Facebook, custom RTMP). Save a destination
          once, then attach it to any <Link to="/routers-channels" style={{color: ACCENT}}>Channel</Link>.
          A destination is fed by one channel at a time.
        </div>
        {loading ? (
          <div role="status" style={{textAlign: "center", padding: 72, ...mono, fontSize: 12, color: MUTED, letterSpacing: "0.15em"}}>LOADING…</div>
        ) : error ? (
          <div role="alert" style={{background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 28, textAlign: "center"}}>
            <div style={{...mono, fontSize: 13, color: DANGER, marginBottom: 10}}>⚠ {error}</div>
            <Btn variant="primary" onClick={load}>Retry</Btn>
          </div>
        ) : dests.length === 0 ? (
          <div style={{textAlign: "center", padding: "56px 24px"}}>
            <div aria-hidden="true" style={{fontSize: 40, marginBottom: 14, color: BORDER}}>⬡</div>
            <div style={{...syne, fontSize: 15, color: SECOND, marginBottom: 6}}>No destinations yet</div>
            <div style={{fontSize: 12, color: MUTED, marginBottom: 20}}>Save a YouTube/Facebook/RTMP target to reuse across channels</div>
            <Btn variant="primary" onClick={() => setModal({mode: "add"})}>+ Add Destination</Btn>
          </div>
        ) : (
          <div style={{display: "flex", flexDirection: "column", gap: 10}}>
            {dests.map(dest => (
              <DestCard key={dest.id} dest={dest} attachedTo={attachMap[dest.id] || []}
                onEdit={(d) => setModal({mode: "edit", dest: d})} onDelete={handleDelete}/>
            ))}
          </div>
        )}
      </main>

      {modal && (
        <DestModal initial={modal.dest} saving={saving} onSave={handleSave} onClose={() => setModal(null)}/>
      )}
    </div>
  );
}
