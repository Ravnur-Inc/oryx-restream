//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
// Owner-only System health panel: live host (CPU load / memory / disk) and app
// (SRS up, FFmpeg forwards, goroutines/threads, uptime) metrics from
// /terraform/v1/mgmt/system. A lightweight at-a-glance view; for history +
// alerting use Azure Monitor (see deploy guide).
import React from "react";
import axios from "axios";
import {Token} from "../utils";
import {SrsErrorBoundary} from "../components/SrsErrorBoundary";
import {useToast, apiError} from "../components/useToast";
import {ACCENT, CARD, PANEL, BORDER, HEADING, SECOND, MUTED, mono, syne} from "../components/tokens";

export default function System() {
  return (
    <SrsErrorBoundary>
      <SystemImpl/>
    </SrsErrorBoundary>
  );
}

const GREEN = "#15803d", AMBER = "#b45309", RED = "#b91c1c";
const barColor = (pct) => (pct >= 90 ? RED : pct >= 70 ? AMBER : GREEN);

function formatBytes(n) {
  if (!n && n !== 0) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
function formatKB(kb) { return formatBytes((kb || 0) * 1024); }
function formatUptime(sec) {
  if (!sec) return "—";
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Btn({children, onClick}) {
  return (
    <button onClick={onClick} style={{
      ...syne, fontWeight: 700, letterSpacing: "0.04em", fontSize: 13, padding: "8px 18px",
      borderRadius: 5, cursor: "pointer", border: "1.5px solid", background: PANEL, color: SECOND, borderColor: BORDER,
    }}>{children}</button>
  );
}

function Card({title, children}) {
  return (
    <div style={{background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)"}}>
      <div style={{...mono, fontSize: 10, color: MUTED, letterSpacing: "0.12em", marginBottom: 12}}>{title}</div>
      {children}
    </div>
  );
}

// A labelled progress bar (0-100%) with threshold coloring.
function Gauge({label, pct, detail}) {
  const c = barColor(pct);
  return (
    <div style={{marginBottom: 12}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5}}>
        <span style={{...mono, fontSize: 11, color: SECOND}}>{label}</span>
        <span style={{...mono, fontSize: 12, fontWeight: 700, color: c}}>{pct != null ? `${pct}%` : "—"}</span>
      </div>
      <div style={{height: 8, background: PANEL, borderRadius: 4, overflow: "hidden"}}>
        <div style={{width: `${Math.min(100, Math.max(0, pct || 0))}%`, height: "100%", background: c, transition: "width 0.4s"}}/>
      </div>
      {detail && <div style={{...mono, fontSize: 10, color: MUTED, marginTop: 4}}>{detail}</div>}
    </div>
  );
}

function Metric({label, value, color}) {
  return (
    <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", borderTop: `1px solid ${PANEL}`}}>
      <span style={{...mono, fontSize: 11, color: MUTED}}>{label}</span>
      <span style={{...mono, fontSize: 13, fontWeight: 600, color: color || HEADING}}>{value}</span>
    </div>
  );
}

function SystemImpl() {
  const [info, setInfo] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [lastRefresh, setLastRefresh] = React.useState(null);
  const {showError, Toaster} = useToast();
  const timerRef = React.useRef();

  const refresh = React.useCallback((showLoader = false) => {
    if (showLoader) setLoading(true);
    axios.post('/terraform/v1/mgmt/system', {}, {headers: Token.loadBearerHeader()})
      .then(res => { setInfo(res.data.data); setError(null); setLastRefresh(new Date()); })
      .catch(e => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    refresh(true);
    timerRef.current = setInterval(() => refresh(false), 5000);
    return () => clearInterval(timerRef.current);
  }, [refresh]);

  return (
    <div style={{maxWidth: 980, margin: "0 auto", ...syne}}>
      {Toaster}
      <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 6, flexWrap: "wrap"}}>
        <span style={{...syne, fontWeight: 800, fontSize: 20, color: HEADING}}>System health</span>
        <div style={{display: "flex", alignItems: "center", gap: 10}}>
          {lastRefresh && <span style={{...mono, fontSize: 10, color: MUTED}}>↺ {lastRefresh.toLocaleTimeString()}</span>}
          <Btn onClick={() => refresh(true)}>Refresh</Btn>
        </div>
      </div>
      <div style={{fontSize: 13, color: MUTED, marginBottom: 20}}>
        Live host and application metrics (refreshes every 5s). For history and alerting, enable Azure Monitor on the VM.
      </div>

      {loading ? (
        <div role="status" style={{textAlign: "center", padding: 72, ...mono, fontSize: 12, color: MUTED, letterSpacing: "0.15em"}}>LOADING…</div>
      ) : error ? (
        <div role="alert" style={{background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 28, textAlign: "center"}}>
          <div style={{...mono, fontSize: 13, color: RED, marginBottom: 10}}>⚠ {error}</div>
          <Btn onClick={() => refresh(true)}>Retry</Btn>
        </div>
      ) : info ? (
        <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16}}>
          <Card title="CPU">
            <Gauge label={`Load (1m) · ${info.cpuCores} cores`} pct={info.loadPct}
              detail={`load avg ${info.load1?.toFixed(2)} / ${info.load5?.toFixed(2)} / ${info.load15?.toFixed(2)}`}/>
          </Card>

          <Card title="Memory">
            <Gauge label="Used" pct={info.memUsedPct}
              detail={`${formatKB(info.memUsedKB)} of ${formatKB(info.memTotalKB)} · ${formatKB(info.memAvailKB)} free`}/>
          </Card>

          <Card title="Disk">
            {(info.disks || []).map(d => (
              <Gauge key={d.path} label={d.path} pct={d.usedPct}
                detail={`${formatBytes(d.usedBytes)} of ${formatBytes(d.totalBytes)} · ${formatBytes(d.freeBytes)} free`}/>
            ))}
            {(!info.disks || !info.disks.length) && <div style={{...mono, fontSize: 11, color: MUTED}}>n/a</div>}
          </Card>

          <Card title="Application">
            <Metric label="SRS media server" value={info.srsUp ? "● up" : "■ down"} color={info.srsUp ? GREEN : RED}/>
            <Metric label="FFmpeg forwards" value={info.ffmpegForwards}/>
            <Metric label="Goroutines" value={info.goroutines}/>
            <Metric label="OS threads" value={info.threads}/>
            <Metric label="Platform memory (RSS)" value={formatKB(info.procRssKB)}/>
            <Metric label="Go heap" value={formatKB(info.heapAllocKB)}/>
          </Card>

          <Card title="Uptime">
            <Metric label="Host" value={formatUptime(info.hostUptimeSec)}/>
            <Metric label="Platform process" value={formatUptime(info.procUptimeSec)}/>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
