//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
import {test, expect, describe} from "vitest";
import {parseFrameLog, contributionHealth, egressHealth} from "./HealthBadge";

describe("parseFrameLog", () => {
  test("extracts fps, bitrate and speed (with spaces after =)", () => {
    const log = "frame= 1234 fps= 30 q=-1.0 size=2048kB time=00:01:23.45 bitrate=2500.0kbits/s speed=1.0x";
    expect(parseFrameLog(log)).toEqual({fps: 30, bitrate: "2500.0kbits/s", speed: 1.0});
  });
  test("returns nulls for empty/absent log", () => {
    expect(parseFrameLog("")).toEqual({fps: null, bitrate: null, speed: null});
    expect(parseFrameLog(null)).toEqual({fps: null, bitrate: null, speed: null});
  });
  test("parses a sub-realtime speed", () => {
    expect(parseFrameLog("fps=12 bitrate=900kbits/s speed=0.82x").speed).toBe(0.82);
  });
});

describe("contributionHealth", () => {
  test("idle when no publisher", () => {
    expect(contributionHealth({active: false}).level).toBe("idle");
  });
  test("stalled when live but bitrate is exactly 0", () => {
    expect(contributionHealth({active: true, bitrate: 0}).level).toBe("warning");
  });
  test("healthy when live and bitrate unknown (undefined)", () => {
    expect(contributionHealth({active: true}).level).toBe("healthy");
  });
  test("healthy when live with positive bitrate", () => {
    expect(contributionHealth({active: true, bitrate: 2500}).level).toBe("healthy");
  });
});

describe("egressHealth", () => {
  test("blocked takes priority over everything", () => {
    expect(egressHealth({enabled: true, running: true, blocked: true, speed: 1}).level).toBe("blocked");
  });
  test("off when disabled", () => {
    expect(egressHealth({enabled: false, running: false}).level).toBe("idle");
    expect(egressHealth({enabled: false, running: false}).label).toBe("OFF");
  });
  test("healthy when running at real-time", () => {
    expect(egressHealth({enabled: true, running: true, speed: 1.0}).level).toBe("healthy");
  });
  test("degraded when running below the speed floor", () => {
    expect(egressHealth({enabled: true, running: true, speed: 0.8}).level).toBe("warning");
  });
  test("healthy when running but speed not yet reported", () => {
    expect(egressHealth({enabled: true, running: true, speed: null}).level).toBe("healthy");
  });
  test("DOWN when enabled and source is live but not forwarding", () => {
    const h = egressHealth({enabled: true, running: false, sourceLive: true});
    expect(h.level).toBe("down");
    expect(h.label).toBe("DOWN");
  });
  test("WAITING when enabled but source is not live", () => {
    const h = egressHealth({enabled: true, running: false, sourceLive: false});
    expect(h.level).toBe("idle");
    expect(h.label).toBe("WAITING");
  });
});
