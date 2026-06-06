//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
// Per-channel Monitor — a single pane of glass for one channel: a live preview
// of the contribution feed alongside contribution health and per-output egress
// health. Reached from a channel's "Monitor" button (/routers-monitor/<name>).
import React from "react";
import axios from "axios";
import {Link, useParams} from "react-router-dom";
import {Token} from "../utils";
import {SrsErrorBoundary} from "../components/SrsErrorBoundary";
import {useToast, apiError} from "../components/useToast";
import FlvPlayer from "../components/FlvPlayer";
import {HealthBadge, contributionHealth, egressHealth, parseFrameLog} from "../components/HealthBadge";
import {ACCENT, ACCENT_SOFT, ACCENT_ON_SOFT, PANEL, BORDER, HEADING, BODY, SECOND, MUTED, mono, syne} from "../components/tokens";

export default function Monitor() {
  return (
    <SrsErrorBoundary>
      <MonitorImpl />
    </SrsErrorBoundary>
  );
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiPost(path, body = {}) {
  const res = await axios.post(path, body, {headers: Token.loadBearerHeader()});
  if (res.data.code !== 0) throw new Error(res.data.message || `API error code ${res.data.code}`);
  return res.data;
}
async function apiGet(path) {
  const res = await axios.get(path, {headers: Token.loadBearerHeader()});
  if (res.data.code !== 0) throw new Error(`API error code ${res.data.code}`);
  return res.data;
}
const listChannels   = () => apiPost("/terraform/v1/mgmt/channels");
const listForwards   = () => apiPost("/terraform/v1/ffmpeg/forward/secret");
const listFwStreams  = () => apiPost("/terraform/v1/ffmpeg/forward/streams");
const listSrcStreams = () => apiPost("/terraform/v1/mgmt/streams/query");
const querySrsStats  = () => apiGet("/api/v1/streams");
const kickoffStream  = (s) => apiPost("/terraform/v1/mgmt/streams/kickoff", {vhost: s.vhost, app: s.app, stream: s.stream});

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, "0")).join(":");
}

function Btn({children, onClick, variant = "dim"}) {
  const variants = {
    primary: {background: ACCENT, color: "#fff", borderColor: ACCENT},
    dim: {background: PANEL, color: SECOND, borderColor: BORDER},
  };
  return (
    <button onClick={onClick} style={{
      ...syne, fontWeight: 700, letterSpacing: "0.04em", fontSize: 13, padding: "8px 18px",
      borderRadius: 5, cursor: "pointer", border: "1.5px solid", ...variants[variant],
    }}>{children}</button>
  );
}

// ── A labelled metric pill ────────────────────────────────────────────────────
function Metric({label, value}) {
  if (value == null || value === "") return null;
  return (
    <span style={{...mono, fontSize: 11, color: ACCENT_ON_SOFT, background: ACCENT_SOFT, border: "1px solid transparent", padding: "3px 9px", borderRadius: 3, letterSpacing: "0.06em"}}>
      <span style={{color: MUTED, marginRight: 6}}>{label}</span>{value}
    </span>
  );
}

// ── One output row ────────────────────────────────────────────────────────────
function OutputRow({dest, stream, sourceLive}) {
  const live = !!stream?.ready;
  const {fps, bitrate, speed} = parseFrameLog(stream?.frame?.log);
  const health = egressHealth({enabled: dest.enabled, running: live, blocked: !!stream?.blocked, speed, sourceLive});
  return (
    <div style={{padding: "12px 0", borderTop: `1px solid ${PANEL}`, display: "flex", alignItems: "center", gap: 12}}>
      <div style={{minWidth: 0, flex: 1}}>
        <div style={{...syne, fontSize: 13, fontWeight: 600, color: HEADING}}>{dest.label || dest.platform}</div>
        <div style={{...mono, fontSize: 10, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{dest.server}</div>
        {live && (
          <div style={{display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6}}>
            {fps != null && <Metric label="FPS" value={fps}/>}
            {bitrate && <Metric label="BITRATE" value={bitrate}/>}
            {speed != null && <Metric label="SPEED" value={`${speed}×`}/>}
          </div>
        )}
      </div>
      <HealthBadge level={health.level} label={health.label} title={health.detail}/>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function MonitorImpl() {
  const {name} = useParams();
  const [channel, setChannel] = React.useState(undefined); // undefined=loading, null=not found
  const [dests, setDests] = React.useState([]);
  const [streamMap, setStreamMap] = React.useState({});
  const [sourceLive, setSourceLive] = React.useState(false);
  const [srcStream, setSrcStream] = React.useState(null); // SrsStream from streams/query (for uptime)
  const [srs, setSrs] = React.useState(null);             // /api/v1/streams entry (codec/res/bitrate)
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [lastRefresh, setLastRefresh] = React.useState(null);
  const {Toaster, showError} = useToast();
  const timerRef = React.useRef();

  const refresh = React.useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const [chR, fwR, fwsR, srcR, srsR] = await Promise.allSettled([
        listChannels(), listForwards(), listFwStreams(), listSrcStreams(), querySrsStats(),
      ]);
      const channels = chR.status === "fulfilled" ? (chR.value.data || []) : [];
      const forwards = fwR.status === "fulfilled" ? (fwR.value.data || {}) : {};
      const fwStreams = fwsR.status === "fulfilled" ? (fwsR.value.data || []) : [];
      const srcStreams = srcR.status === "fulfilled" ? (srcR.value.data?.streams || []) : [];
      const srsStreams = srsR.status === "fulfilled" ? (srsR.value.streams || []) : [];

      setChannel(channels.find(c => c.name === name) || null);
      setDests(Object.values(forwards).filter(f => f.stream === name));
      setStreamMap(Object.fromEntries(fwStreams.map(s => [s.platform, s])));
      const src = srcStreams.find(s => s.stream === name) || null;
      setSrcStream(src);
      setSourceLive(!!src);
      setSrs(srsStreams.find(s => s.app === "live" && s.name === name) || null);
      setLastRefresh(new Date());
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [name]);

  React.useEffect(() => {
    refresh(true);
    timerRef.current = setInterval(() => refresh(false), 5000);
    return () => clearInterval(timerRef.current);
  }, [refresh]);

  const handleReset = async () => {
    if (!srcStream) return;
    if (!window.confirm(`Reset the source for "${channel?.label || name}"?\n\nThis disconnects the current publisher; the encoder will reconnect automatically.`)) return;
    try { await kickoffStream(srcStream); await refresh(true); }
    catch (e) { showError(e); }
  };

  const health = contributionHealth({active: sourceLive, bitrate: srs?.kbps?.recv_30s});
  const startMs = srcStream?.update ? new Date(srcStream.update).getTime() : null;
  const uptime = startMs ? formatUptime(Math.max(0, Date.now() - startMs)) : null;
  const v = srs?.video;
  const resolution = v?.width && v?.height ? `${v.width}×${v.height}` : null;
  const flvUrl = `${window.location.origin}/live/${name}.flv`;

  return (
    <div style={{maxWidth: 1120, margin: "0 auto", ...syne}}>
      {Toaster}
      <Link to="/routers-channels" style={{...mono, fontSize: 12, color: ACCENT, textDecoration: "none"}}>← Channels</Link>

        {loading ? (
          <div role="status" style={{textAlign: "center", padding: 72, ...mono, fontSize: 12, color: MUTED, letterSpacing: "0.15em"}}>LOADING…</div>
        ) : error ? (
          <div role="alert" style={{background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 28, textAlign: "center", marginTop: 16}}>
            <div style={{...mono, fontSize: 13, color: "#b91c1c", marginBottom: 10}}>⚠ {error}</div>
            <Btn variant="primary" onClick={() => refresh(true)}>Retry</Btn>
          </div>
        ) : channel === null ? (
          <div style={{textAlign: "center", padding: "56px 24px"}}>
            <div style={{...syne, fontSize: 15, color: SECOND, marginBottom: 6}}>Channel not found</div>
            <div style={{fontSize: 12, color: MUTED}}>No channel publishes the stream <b>{name}</b>.</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{display: "flex", alignItems: "center", gap: 14, margin: "14px 0 22px"}}>
              <div style={{width: 5, height: 30, background: sourceLive ? ACCENT : "#c8c4be", borderRadius: 3}}/>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{...syne, fontWeight: 800, fontSize: 22, color: HEADING}}>{channel.label}</div>
                {channel.description && <div style={{...mono, fontSize: 12, color: MUTED}}>{channel.description}</div>}
              </div>
              {sourceLive && <Btn variant="dim" onClick={handleReset}>Reset source</Btn>}
              <HealthBadge level={health.level} label={health.label} title={health.detail}/>
            </div>

            {/* Two columns: preview + info */}
            <div style={{display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 1fr)", gap: 22, alignItems: "start"}}>
              {/* Preview */}
              <div>
                {sourceLive ? (
                  <FlvPlayer url={flvUrl} style={{border: `1px solid ${BORDER}`}}/>
                ) : (
                  <div style={{width: "100%", aspectRatio: "16 / 9", background: "#1a1816", borderRadius: 6, border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8}}>
                    <div style={{...syne, fontSize: 15, color: "#d8d4cf"}}>Source is idle</div>
                    <div style={{...mono, fontSize: 11, color: "#9a958f"}}>Waiting for an encoder to publish <b>{name}</b></div>
                  </div>
                )}
                <div style={{...mono, fontSize: 10, color: MUTED, marginTop: 8, wordBreak: "break-all"}}>{flvUrl}</div>
              </div>

              {/* Info */}
              <div style={{display: "flex", flexDirection: "column", gap: 18}}>
                {/* Contribution */}
                <section style={{background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 18px"}}>
                  <div style={{...mono, fontSize: 10, color: MUTED, letterSpacing: "0.12em", marginBottom: 10}}>CONTRIBUTION</div>
                  <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 12}}>
                    <HealthBadge level={health.level} label={health.label} title={health.detail}/>
                    <span style={{...mono, fontSize: 11, color: SECOND}}>{channel.name}</span>
                  </div>
                  <div style={{display: "flex", gap: 6, flexWrap: "wrap"}}>
                    {v?.codec && <Metric label="VIDEO" value={[v.codec, resolution].filter(Boolean).join("  ")}/>}
                    {srs?.audio?.codec && <Metric label="AUDIO" value={srs.audio.codec}/>}
                    {srs?.kbps?.recv_30s > 0 && <Metric label="BITRATE" value={`${srs.kbps.recv_30s} kbps`}/>}
                    {uptime && <Metric label="UPTIME" value={uptime}/>}
                  </div>
                </section>

                {/* Outputs */}
                <section style={{background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 18px"}}>
                  <div style={{...mono, fontSize: 10, color: MUTED, letterSpacing: "0.12em", marginBottom: 4}}>OUTPUTS · {dests.length}</div>
                  {dests.length === 0 ? (
                    <div style={{...mono, fontSize: 12, color: MUTED, paddingTop: 10}}>
                      No destinations attached. Add some on the <Link to="/routers-channels" style={{color: ACCENT}}>Channels</Link> page.
                    </div>
                  ) : (
                    dests.map(d => <OutputRow key={d.platform} dest={d} stream={streamMap[d.platform]} sourceLive={sourceLive}/>)
                  )}
                </section>
              </div>
            </div>
          </>
        )}
    </div>
  );
}
