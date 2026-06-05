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

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiPost(path, body = {}) {
  const res = await axios.post(path, body, {headers: Token.loadBearerHeader()});
  if (res.data.code !== 0) throw new Error(res.data.message || `API error code ${res.data.code}`);
  return res.data;
}
const listChannels   = () => apiPost("/terraform/v1/mgmt/channels");
const listForwards   = () => apiPost("/terraform/v1/ffmpeg/forward/secret");
const listFwStreams  = () => apiPost("/terraform/v1/ffmpeg/forward/streams");
const listSrcStreams = () => apiPost("/terraform/v1/mgmt/streams/query");
const listDestLib    = () => apiPost("/terraform/v1/mgmt/destinations");
const querySecret    = () => apiPost("/terraform/v1/hooks/srs/secret/query");
const upsertDest     = (p) => apiPost("/terraform/v1/ffmpeg/forward/secret", {action: "update", ...p});
const deleteDest     = (platform) => apiPost("/terraform/v1/ffmpeg/forward/secret", {action: "delete", platform});

function genPlatformKey() {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const chars   = "abcdefghijklmnopqrstuvwxyz0123456789";
  return letters[Math.floor(Math.random() * letters.length)]
    + Array.from({length: 11}, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT="#b54100", BG="#f5f4f1", CARD="#fff", PANEL="#edecea", BORDER="#888582",
  HEADING="#111", BODY="#2b2926", SECOND="#4a4744", MUTED="#6b6865", DANGER="#b91c1c";
const mono = {fontFamily: "'Public Sans', sans-serif", fontVariantNumeric: "tabular-nums"};
const syne = {fontFamily: "'Public Sans', sans-serif"};
const inputBase = {...mono, fontSize: 13, color: BODY, background: CARD, border: `1.5px solid ${BORDER}`, borderRadius: 5, outline: "none", transition: "border-color 0.15s", width: "100%"};
const lbl = {display: "block", ...mono, fontSize: 10, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7};
const iconBtn = {background: "none", border: "1px solid transparent", color: SECOND, cursor: "pointer", fontSize: 15, padding: "3px 6px", lineHeight: 1, borderRadius: 4, transition: "all 0.15s"};
const NAME_RE = /^[a-zA-Z0-9_-]+$/;

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
function Dot({live}) {
  return <span aria-hidden="true" style={{display: "inline-block", width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: live ? ACCENT : "#b0aca8", boxShadow: live ? `0 0 0 3px rgba(181,65,0,0.15)` : "none", transition: "all 0.4s"}}/>;
}
function Toggle({value, onChange, label}) {
  return (
    <div role="switch" aria-checked={value} aria-label={label} onClick={() => onChange(!value)}
      style={{width: 36, height: 20, borderRadius: 10, cursor: "pointer", background: value ? ACCENT : "#c8c4be", border: `1.5px solid ${value ? ACCENT : "#b0aca8"}`, position: "relative", transition: "all 0.2s", flexShrink: 0}}>
      <div style={{position: "absolute", top: 3, left: value ? 18 : 3, width: 12, height: 12, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 0.2s"}}/>
    </div>
  );
}
function CopyField({label, value}) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); }
    catch { const ta = document.createElement("textarea"); ta.value = value; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch {} document.body.removeChild(ta); }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div style={{marginBottom: 10}}>
      <label style={lbl}>{label}</label>
      <div style={{display: "flex", gap: 8}}>
        <input readOnly value={value} onFocus={e => e.target.select()} style={{...inputBase, padding: "7px 10px"}}/>
        <Btn variant={copied ? "primary" : "dim"} small onClick={copy} style={{whiteSpace: "nowrap"}}>{copied ? "Copied ✓" : "Copy"}</Btn>
      </div>
    </div>
  );
}
function fwStat(log) {
  if (!log) return null;
  const fps = log.match(/fps=(\S+)/)?.[1];
  const br  = log.match(/bitrate=(\S+)/)?.[1];
  return [fps && `FPS ${fps}`, br && `${br}`].filter(Boolean).join("  ");
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
function NavBar({onAdd, lastRefresh, onRefresh}) {
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
      <div style={{display: "flex", alignItems: "center", gap: 12, paddingLeft: 16}}>
        {lastRefresh && <span style={{...mono, fontSize: 10, color: MUTED}}>↺ {lastRefresh.toLocaleTimeString()}</span>}
        <Btn variant="dim" onClick={onRefresh}>Refresh</Btn>
        <Btn variant="primary" onClick={onAdd}>+ Add Channel</Btn>
      </div>
    </div>
  );
}

// ── Destination row (within a channel) ────────────────────────────────────────
function DestRow({dest, stream, onToggle, onDetach}) {
  const [confirmDel, setConfirmDel] = React.useState(false);
  const live = !!(stream?.ready);
  const stat = live && fwStat(stream?.frame?.log);
  return (
    <div style={{padding: "10px 0", borderTop: `1px solid ${PANEL}`}}>
      <div style={{display: "flex", alignItems: "center", gap: 10}}>
        <Dot live={live}/>
        <div style={{minWidth: 0, flex: 1}}>
          <div style={{...syne, fontSize: 13, fontWeight: 600, color: HEADING}}>{dest.label || dest.platform}</div>
          <div style={{...mono, fontSize: 10, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{dest.server}</div>
        </div>
        {stat && <span style={{...mono, fontSize: 10, color: ACCENT, background: "rgba(181,65,0,0.06)", border: "1px solid rgba(181,65,0,0.2)", padding: "2px 8px", borderRadius: 3}}>{stat}</span>}
        <span style={{...mono, fontSize: 9, letterSpacing: "0.08em", color: live ? ACCENT : SECOND}}>{live ? "● LIVE" : "○ IDLE"}</span>
        <Toggle value={dest.enabled} onChange={() => onToggle(dest)} label={`Toggle ${dest.label || dest.platform}`}/>
        <button onClick={() => setConfirmDel(true)} aria-label="Detach destination" title="Detach from this channel" style={iconBtn}
          onMouseEnter={e => {e.currentTarget.style.color = DANGER; e.currentTarget.style.background = "#fef2f2";}}
          onMouseLeave={e => {e.currentTarget.style.color = SECOND; e.currentTarget.style.background = "none";}}>✕</button>
      </div>
      {confirmDel && (
        <div role="alertdialog" style={{marginTop: 8, padding: "10px 12px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fca5a5"}}>
          <div style={{...syne, fontSize: 12, color: DANGER, marginBottom: 8}}>
            Detach "{dest.label || dest.platform}" from this channel? {dest.destinationId ? "The destination stays in the library." : ""}
          </div>
          <div style={{display: "flex", gap: 8}}>
            <Btn variant="ghost" small onClick={() => setConfirmDel(false)}>Cancel</Btn>
            <Btn variant="danger" small onClick={() => {setConfirmDel(false); onDetach(dest);}}>Detach</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Channel card (route) ──────────────────────────────────────────────────────
function ChannelCard({channel, urls, dests, streamMap, sourceLive, onEdit, onDelete, onAddDest, onToggleDest, onDetachDest, onStartAll, onStopAll}) {
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [showUrls, setShowUrls] = React.useState(false);
  const liveCount = dests.filter(d => streamMap[d.platform]?.ready).length;
  const enabledCount = dests.filter(d => d.enabled).length;
  return (
    <article style={{background: CARD, borderRadius: 8, padding: "18px 22px", border: `1px solid ${BORDER}`, borderLeft: `3px solid ${sourceLive ? ACCENT : "#c8c4be"}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)"}}>
      <div style={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12}}>
        <div style={{display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1}}>
          <Dot live={sourceLive}/>
          <div style={{minWidth: 0, flex: 1}}>
            <div style={{...syne, fontWeight: 700, fontSize: 14, color: HEADING}}>{channel.label}</div>
            {channel.description && <div style={{...mono, fontSize: 11, color: MUTED}}>{channel.description}</div>}
            <div style={{display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4}}>
              <span style={{...mono, fontSize: 10, color: MUTED}}>STREAM <span style={{color: SECOND}}>{channel.name}</span></span>
              <span style={{...mono, fontSize: 10, color: MUTED}}>SOURCE <span style={{color: sourceLive ? ACCENT : SECOND}}>{sourceLive ? "live" : "idle"}</span></span>
              <span style={{...mono, fontSize: 10, color: MUTED}}>OUTPUTS <span style={{color: liveCount ? ACCENT : SECOND}}>{liveCount} live</span> / {dests.length}</span>
            </div>
          </div>
        </div>
        <div style={{display: "flex", alignItems: "center", gap: 8, flexShrink: 0}}>
          <Btn variant="dim" small onClick={() => setExpanded(e => !e)}>{expanded ? "Collapse" : `Manage (${dests.length})`}</Btn>
          <button onClick={() => onEdit(channel)} aria-label="Edit channel" style={iconBtn}
            onMouseEnter={e => {e.currentTarget.style.color = HEADING; e.currentTarget.style.background = PANEL;}}
            onMouseLeave={e => {e.currentTarget.style.color = SECOND; e.currentTarget.style.background = "none";}}>✎</button>
          <button onClick={() => setConfirmDel(true)} aria-label="Delete channel" style={iconBtn}
            onMouseEnter={e => {e.currentTarget.style.color = DANGER; e.currentTarget.style.background = "#fef2f2";}}
            onMouseLeave={e => {e.currentTarget.style.color = SECOND; e.currentTarget.style.background = "none";}}>✕</button>
        </div>
      </div>

      {expanded && (
        <div style={{marginTop: 14, paddingTop: 14, borderTop: `1px solid ${PANEL}`}}>
          <div style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap"}}>
            <Btn variant="primary" small onClick={() => onAddDest(channel)}>+ Add Destination</Btn>
            <Btn variant="dim" small onClick={() => onStartAll(channel, dests)} disabled={!dests.length || enabledCount === dests.length}>Start all</Btn>
            <Btn variant="dim" small onClick={() => onStopAll(channel, dests)} disabled={!enabledCount}>Stop all</Btn>
            <Btn variant="ghost" small onClick={() => setShowUrls(s => !s)}>{showUrls ? "Hide ingest URLs" : "Ingest URLs"}</Btn>
          </div>

          {showUrls && (
            <div style={{margin: "10px 0", padding: "12px 14px", background: PANEL, borderRadius: 6}}>
              <CopyField label="RTMP server" value={urls.rtmpServer}/>
              <CopyField label="RTMP stream key" value={urls.rtmpKey}/>
              <CopyField label={urls.encrypted ? "SRT URL (encrypted)" : "SRT URL"} value={urls.srtUrl}/>
              <CopyField label="HLS playback" value={urls.hlsUrl}/>
            </div>
          )}

          {dests.length === 0 ? (
            <div style={{...mono, fontSize: 12, color: MUTED, padding: "12px 0", borderTop: `1px solid ${PANEL}`}}>
              No destinations attached. Add one from your <Link to="/routers-destinations" style={{color: ACCENT}}>Destinations</Link> library — it forwards this channel's stream (<b>{channel.name}</b>).
            </div>
          ) : (
            dests.map(d => (
              <DestRow key={d.platform} dest={d} stream={streamMap[d.platform]} onToggle={onToggleDest} onDetach={onDetachDest}/>
            ))
          )}
        </div>
      )}

      {confirmDel && (
        <div role="alertdialog" style={{marginTop: 14, padding: "14px 16px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fca5a5"}}>
          <div style={{...syne, fontSize: 13, color: DANGER, marginBottom: 10}}>
            Delete channel "{channel.label}"? Its destinations are detached but remain in the Destinations library.
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

// ── Channel modal ─────────────────────────────────────────────────────────────
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
    <ModalShell title={initial ? "Edit Channel" : "New Channel"} onClose={onClose}>
      <Field id="ch-label" label="Channel Label" ph="e.g. Sunday Service" value={form.label} onChange={set("label")}/>
      <div style={{marginBottom: 18}}>
        <label htmlFor="ch-name" style={lbl}>Stream Name</label>
        <input id="ch-name" type="text" spellCheck={false} autoComplete="off" maxLength={100}
          style={{...inputBase, padding: "9px 12px", borderColor: (!form.name || nameValid) ? BORDER : DANGER}}
          placeholder="e.g. sunday-service" value={form.name} onChange={set("name")}
          onFocus={e => (e.target.style.borderColor = (!form.name || nameValid) ? ACCENT : DANGER)}
          onBlur={e => (e.target.style.borderColor = (!form.name || nameValid) ? BORDER : DANGER)}/>
        <span style={{...mono, fontSize: 10, color: (!form.name || nameValid) ? MUTED : DANGER, marginTop: 5, display: "block"}}>
          The publish stream name. Destinations attached to this channel forward this stream.
        </span>
      </div>
      <Field id="ch-desc" label="Description — optional" ph="e.g. Main auditorium camera" value={form.description} onChange={set("description")}/>
      <div style={{display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={!valid || saving} onClick={() => valid && onSave({...form, id: initial?.id})}>{saving ? "Saving…" : "Save Channel"}</Btn>
      </div>
    </ModalShell>
  );
}

// ── Attach-destination modal (from the library, or create new) ────────────────
function AttachModal({channel, library, attachedHere, onAttach, onCreate, onClose, saving}) {
  // Library entries not already attached to THIS channel.
  const options = library.filter(d => !attachedHere.has(d.id));
  const [mode, setMode] = React.useState(options.length ? "existing" : "new");
  const [pick, setPick] = React.useState(options[0]?.id || "");
  const [form, setForm] = React.useState({label: "", server: "", secret: ""});
  const set = (k) => (e) => setForm(f => ({...f, [k]: e.target.value}));
  const formValid = form.label.trim() && form.server.trim();
  const chosen = options.find(d => d.id === pick);
  React.useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const useExisting = mode === "existing";
  const canSave = useExisting ? !!chosen : formValid;
  return (
    <ModalShell title={`Add Destination — ${channel.label}`} onClose={onClose}>
      <div style={{...mono, fontSize: 11, color: MUTED, marginBottom: 16}}>Forwards this channel's stream <b>{channel.name}</b>.</div>
      <div style={{display: "flex", gap: 8, marginBottom: 18}}>
        <Btn variant={useExisting ? "primary" : "dim"} small onClick={() => setMode("existing")} disabled={!options.length}>From library</Btn>
        <Btn variant={!useExisting ? "primary" : "dim"} small onClick={() => setMode("new")}>New destination</Btn>
      </div>

      {useExisting ? (
        options.length ? (
          <div style={{marginBottom: 24}}>
            <label htmlFor="att-pick" style={lbl}>Destination</label>
            <select id="att-pick" value={pick} onChange={e => setPick(e.target.value)} style={{...inputBase, padding: "9px 12px"}}>
              {options.map(d => (
                <option key={d.id} value={d.id}>{d.label} — {d.server}{d.attachedTo ? ` (currently: ${d.attachedTo})` : ""}</option>
              ))}
            </select>
            <span style={{...mono, fontSize: 10, color: MUTED, marginTop: 5, display: "block"}}>
              Attaches this destination to the channel. If it's attached elsewhere, it moves here — a destination is fed by one channel at a time.
            </span>
          </div>
        ) : (
          <div style={{...mono, fontSize: 12, color: MUTED, marginBottom: 24}}>No library destinations available. Create a new one →</div>
        )
      ) : (
        <>
          <Field id="att-label" label="Label" ph="e.g. YouTube — Main Channel" value={form.label} onChange={set("label")}/>
          <Field id="att-server" label="RTMP Server URL" ph="rtmp://a.rtmp.youtube.com/live2" value={form.server} onChange={set("server")}/>
          <Field id="att-secret" label="Stream Key / Secret" ph="xxxx-xxxx-xxxx-xxxx" value={form.secret} onChange={set("secret")}/>
          <div style={{...mono, fontSize: 10, color: MUTED, marginBottom: 18}}>Saved to the Destinations library and attached to this channel.</div>
        </>
      )}

      <div style={{display: "flex", gap: 10, justifyContent: "flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={!canSave || saving} onClick={() => { if (!canSave) return; useExisting ? onAttach(chosen) : onCreate(form); }}>
          {saving ? "Saving…" : (useExisting ? "Attach" : "Create & Attach")}
        </Btn>
      </div>
    </ModalShell>
  );
}

function ModalShell({title, onClose, children}) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.target === e.currentTarget && onClose()}
      style={{position: "fixed", inset: 0, background: "rgba(43,41,38,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)"}}>
      <div style={{background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "32px 36px", width: 500, maxWidth: "92vw", boxShadow: "0 24px 60px rgba(0,0,0,0.18)"}}>
        <div style={{display: "flex", alignItems: "center", gap: 12, marginBottom: 24}}>
          <div style={{width: 5, height: 28, background: ACCENT, borderRadius: 3}}/>
          <span style={{...syne, fontWeight: 800, fontSize: 18, color: HEADING}}>{title}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({id, label, ph, value, onChange}) {
  return (
    <div style={{marginBottom: 18}}>
      <label htmlFor={id} style={lbl}>{label}</label>
      <input id={id} type="text" style={{...inputBase, padding: "9px 12px"}} placeholder={ph} value={value} onChange={onChange}
        onFocus={e => (e.target.style.borderColor = ACCENT)} onBlur={e => (e.target.style.borderColor = BORDER)}/>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function ChannelsImpl() {
  const [channels, setChannels] = React.useState([]);
  const [secret, setSecret] = React.useState(null);
  const [forwards, setForwards] = React.useState({});
  const [fwStreams, setFwStreams] = React.useState([]);
  const [activeSrc, setActiveSrc] = React.useState(new Set());
  const [library, setLibrary] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [lastRefresh, setLastRefresh] = React.useState(null);
  const [modal, setModal] = React.useState(null); // {type:'channel'|'attach', channel?}
  const [saving, setSaving] = React.useState(false);
  const env = React.useContext(SrsEnvContext)[0];
  const timerRef = React.useRef();

  const load = React.useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const [ch, sec, fw, fws, src, lib] = await Promise.all([
        listChannels(), querySecret(), listForwards(), listFwStreams(), listSrcStreams(), listDestLib(),
      ]);
      setChannels(ch.data || []);
      setSecret(sec.data || {});
      setForwards(fw.data || {});
      setFwStreams(fws.data || []);
      setActiveSrc(new Set((src.data?.streams || []).map(s => s.stream)));
      setLibrary(lib.data || []);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load(true);
    timerRef.current = setInterval(() => load(false), 5000);
    return () => clearInterval(timerRef.current);
  }, [load]);

  const streamMap = React.useMemo(() => Object.fromEntries(fwStreams.map(s => [s.platform, s])), [fwStreams]);
  const destsFor = (name) => Object.values(forwards).filter(f => f.stream === name);
  const channelByStream = React.useMemo(() => Object.fromEntries(channels.map(c => [c.name, c.label])), [channels]);
  // destinationId -> where it's attached (channel label / stream)
  const attachWhere = React.useMemo(() => {
    const m = {};
    Object.values(forwards).forEach(f => { if (f.destinationId) m[f.destinationId] = channelByStream[f.stream] || f.stream; });
    return m;
  }, [forwards, channelByStream]);

  // Channel CRUD
  const saveChannel = async (form) => {
    setSaving(true);
    try {
      await apiPost('/terraform/v1/mgmt/channels', {action: form.id ? 'update' : 'create', ...(form.id ? {id: form.id} : {}), label: form.label.trim(), name: form.name.trim(), description: form.description.trim()});
      setModal(null); await load();
    } catch (e) { alert("Save failed: " + (e.response?.data?.message || e.message)); }
    finally { setSaving(false); }
  };
  const deleteChannel = async (channel) => {
    try {
      // Detach this channel's destinations (delete the forward configs), then remove the channel.
      await Promise.all(destsFor(channel.name).map(d => deleteDest(d.platform)));
      await apiPost('/terraform/v1/mgmt/channels', {action: 'delete', id: channel.id});
      await load();
    } catch (e) { alert("Delete failed: " + (e.response?.data?.message || e.message)); }
  };

  // Attach a library destination to a channel, moving it if attached elsewhere.
  const attachDest = async (channel, libDest) => {
    setSaving(true);
    try {
      const existing = Object.values(forwards).filter(f => f.destinationId === libDest.id);
      for (const e of existing) await deleteDest(e.platform);
      await upsertDest({platform: genPlatformKey(), destinationId: libDest.id, stream: channel.name, server: libDest.server, secret: libDest.secret, label: libDest.label, enabled: true, custom: true});
      setModal(null); await load();
    } catch (e) { alert("Attach failed: " + (e.response?.data?.message || e.message)); }
    finally { setSaving(false); }
  };
  const createAndAttach = async (channel, form) => {
    setSaving(true);
    try {
      const created = (await apiPost('/terraform/v1/mgmt/destinations', {action: 'create', label: form.label.trim(), server: form.server.trim(), secret: form.secret.trim()})).data;
      await upsertDest({platform: genPlatformKey(), destinationId: created.id, stream: channel.name, server: created.server, secret: created.secret, label: created.label, enabled: true, custom: true});
      setModal(null); await load();
    } catch (e) { alert("Create failed: " + (e.response?.data?.message || e.message)); }
    finally { setSaving(false); }
  };
  const detachDest = async (dest) => {
    try { await deleteDest(dest.platform); await load(); }
    catch (e) { alert("Detach failed: " + (e.response?.data?.message || e.message)); }
  };
  const toggleDest = async (dest) => {
    try { await upsertDest({...dest, enabled: !dest.enabled}); await load(); }
    catch (e) { alert("Toggle failed: " + (e.response?.data?.message || e.message)); }
  };
  const setAll = async (dests, enabled) => {
    try { await Promise.all(dests.filter(d => d.enabled !== enabled).map(d => upsertDest({...d, enabled}))); await load(); }
    catch (e) { alert("Failed: " + (e.response?.data?.message || e.message)); }
  };

  const host = window.location.hostname;
  const srtPort = env?.srtPort || "10080";
  const pub = secret?.publish || "";
  const srtPassphrase = secret?.srtPassphrase || "";
  const srtPbkeylen = secret?.srtPbkeylen || "16";

  // Library options annotated with where each is currently attached.
  const libraryAnnotated = library.map(d => ({...d, attachedTo: attachWhere[d.id]}));

  return (
    <div style={{background: BG, color: BODY, ...syne, minHeight: "100vh"}}>
      <NavBar onAdd={() => setModal({type: "channel"})} lastRefresh={lastRefresh} onRefresh={() => load(true)}/>

      <main style={{padding: "28px 32px", maxWidth: 820, margin: "0 auto"}}>
        <div style={{...syne, fontWeight: 800, fontSize: 20, color: HEADING, marginBottom: 4}}>Channels</div>
        <div style={{fontSize: 13, color: MUTED, marginBottom: 24}}>
          A channel is a reusable route: a named ingest plus the <Link to="/routers-destinations" style={{color: ACCENT}}>Destinations</Link> it
          forwards to. Attach destinations, start/stop them, and the route stays consistent across every stream.
        </div>

        {loading ? (
          <div role="status" style={{textAlign: "center", padding: 72, ...mono, fontSize: 12, color: MUTED, letterSpacing: "0.15em"}}>LOADING…</div>
        ) : error ? (
          <div role="alert" style={{background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 28, textAlign: "center"}}>
            <div style={{...mono, fontSize: 13, color: DANGER, marginBottom: 10}}>⚠ {error}</div>
            <Btn variant="primary" onClick={() => load(true)}>Retry</Btn>
          </div>
        ) : channels.length === 0 ? (
          <div style={{textAlign: "center", padding: "56px 24px"}}>
            <div aria-hidden="true" style={{fontSize: 40, marginBottom: 14, color: BORDER}}>⬡</div>
            <div style={{...syne, fontSize: 15, color: SECOND, marginBottom: 6}}>No channels yet</div>
            <div style={{fontSize: 12, color: MUTED, marginBottom: 20}}>Create a channel to manage a reusable ingest + its destinations</div>
            <Btn variant="primary" onClick={() => setModal({type: "channel"})}>+ Add Channel</Btn>
          </div>
        ) : (
          <div style={{display: "flex", flexDirection: "column", gap: 10}}>
            {channels.map(channel => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                dests={destsFor(channel.name)}
                streamMap={streamMap}
                sourceLive={activeSrc.has(channel.name)}
                urls={buildIngestUrls({host, srtPort, name: channel.name, secret: pub, srtPassphrase, srtPbkeylen, origin: window.location.origin})}
                onEdit={(c) => setModal({type: "channel", channel: c})}
                onDelete={deleteChannel}
                onAddDest={(c) => setModal({type: "attach", channel: c})}
                onToggleDest={toggleDest}
                onDetachDest={detachDest}
                onStartAll={(c, ds) => setAll(ds, true)}
                onStopAll={(c, ds) => setAll(ds, false)}
              />
            ))}
          </div>
        )}
      </main>

      {modal?.type === "channel" && (
        <ChannelModal initial={modal.channel} saving={saving} onSave={saveChannel} onClose={() => setModal(null)}/>
      )}
      {modal?.type === "attach" && (
        <AttachModal
          channel={modal.channel}
          library={libraryAnnotated}
          attachedHere={new Set(destsFor(modal.channel.name).map(d => d.destinationId).filter(Boolean))}
          saving={saving}
          onAttach={(d) => attachDest(modal.channel, d)}
          onCreate={(form) => createAndAttach(modal.channel, form)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
