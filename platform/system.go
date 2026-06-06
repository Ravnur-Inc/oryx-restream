// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
package main

import (
	"bufio"
	"context"
	"net/http"
	"os"
	"path"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	// From ossrs.
	"github.com/ossrs/go-oryx-lib/errors"
	ohttp "github.com/ossrs/go-oryx-lib/http"
	"github.com/ossrs/go-oryx-lib/logger"
)

// processStartTime marks when the platform process started, for an uptime metric.
var processStartTime = time.Now()

var systemManager *SystemManager

// SystemManager exposes lightweight host + app health metrics for the in-app
// "System health" panel. Everything is read from /proc and syscalls (Linux), so
// there are no extra dependencies and no external monitoring agent required.
type SystemManager struct{}

func NewSystemManager() *SystemManager { return &SystemManager{} }

type diskInfo struct {
	Path       string `json:"path"`
	TotalBytes uint64 `json:"totalBytes"`
	FreeBytes  uint64 `json:"freeBytes"`
	UsedBytes  uint64 `json:"usedBytes"`
	UsedPct    int    `json:"usedPct"`
}

type systemInfo struct {
	Now           string `json:"now"`
	HostUptimeSec int64  `json:"hostUptimeSec"`
	ProcUptimeSec int64  `json:"procUptimeSec"`

	CPUCores int     `json:"cpuCores"`
	Load1    float64 `json:"load1"`
	Load5    float64 `json:"load5"`
	Load15   float64 `json:"load15"`
	// Load1 as a percentage of cores (>100 means oversubscribed).
	LoadPct int `json:"loadPct"`

	MemTotalKB int64 `json:"memTotalKB"`
	MemAvailKB int64 `json:"memAvailKB"`
	MemUsedKB  int64 `json:"memUsedKB"`
	MemUsedPct int   `json:"memUsedPct"`

	Disks []diskInfo `json:"disks"`

	Goroutines  int   `json:"goroutines"`
	Threads     int   `json:"threads"`
	ProcRssKB   int64 `json:"procRssKB"`
	HeapAllocKB int64 `json:"heapAllocKB"`

	SrsUp          bool `json:"srsUp"`
	FfmpegForwards int  `json:"ffmpegForwards"`
}

func (v *SystemManager) Handle(ctx context.Context, handler *http.ServeMux) error {
	ep := "/terraform/v1/mgmt/system"
	logger.Tf(ctx, "Handle %v", ep)
	handler.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		if err := func() error {
			var token string
			if err := ParseBody(ctx, r.Body, &struct {
				Token *string `json:"token"`
			}{Token: &token}); err != nil {
				return errors.Wrapf(err, "parse body")
			}
			if err := Authenticate(ctx, envApiSecret(), token, r.Header); err != nil {
				return errors.Wrapf(err, "authenticate")
			}

			info := gatherSystemInfo(ctx)
			ohttp.WriteData(ctx, w, r, &info)
			return nil
		}(); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	})
	return nil
}

func gatherSystemInfo(ctx context.Context) systemInfo {
	info := systemInfo{
		Now:           time.Now().Format(time.RFC3339),
		ProcUptimeSec: int64(time.Since(processStartTime).Seconds()),
		CPUCores:      runtime.NumCPU(),
		Goroutines:    runtime.NumGoroutine(),
	}

	info.HostUptimeSec = readHostUptime()

	if l1, l5, l15, ok := readLoadAvg(); ok {
		info.Load1, info.Load5, info.Load15 = l1, l5, l15
		if info.CPUCores > 0 {
			info.LoadPct = int(l1 / float64(info.CPUCores) * 100)
		}
	}

	if total, avail, ok := readMemInfo(); ok {
		info.MemTotalKB, info.MemAvailKB = total, avail
		info.MemUsedKB = total - avail
		if total > 0 {
			info.MemUsedPct = int(float64(info.MemUsedKB) / float64(total) * 100)
		}
	}

	for _, p := range []string{"/", "/data"} {
		if d, ok := statfsPath(p); ok {
			info.Disks = append(info.Disks, d)
		}
	}

	info.Threads, info.ProcRssKB = readSelfThreadsRss()

	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	info.HeapAllocKB = int64(ms.Alloc / 1024)

	info.SrsUp = srsReachable(ctx)
	info.FfmpegForwards = countFfmpegProcesses()

	return info
}

func readHostUptime() int64 {
	b, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(b))
	if len(fields) == 0 {
		return 0
	}
	f, _ := strconv.ParseFloat(fields[0], 64)
	return int64(f)
}

func readLoadAvg() (l1, l5, l15 float64, ok bool) {
	b, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0, 0, 0, false
	}
	fields := strings.Fields(string(b))
	if len(fields) < 3 {
		return 0, 0, 0, false
	}
	l1, _ = strconv.ParseFloat(fields[0], 64)
	l5, _ = strconv.ParseFloat(fields[1], 64)
	l15, _ = strconv.ParseFloat(fields[2], 64)
	return l1, l5, l15, true
}

func readMemInfo() (totalKB, availKB int64, ok bool) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0, false
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		fields := strings.Fields(s.Text())
		if len(fields) < 2 {
			continue
		}
		val, _ := strconv.ParseInt(fields[1], 10, 64) // value is in KB
		switch fields[0] {
		case "MemTotal:":
			totalKB = val
		case "MemAvailable:":
			availKB = val
		}
	}
	return totalKB, availKB, totalKB > 0
}

func statfsPath(p string) (diskInfo, bool) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(p, &st); err != nil {
		return diskInfo{}, false
	}
	bs := uint64(st.Bsize)
	total := st.Blocks * bs
	free := st.Bavail * bs
	used := total - free
	d := diskInfo{Path: p, TotalBytes: total, FreeBytes: free, UsedBytes: used}
	if total > 0 {
		d.UsedPct = int(float64(used) / float64(total) * 100)
	}
	return d, true
}

func readSelfThreadsRss() (threads int, rssKB int64) {
	f, err := os.Open("/proc/self/status")
	if err != nil {
		return 0, 0
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		fields := strings.Fields(s.Text())
		if len(fields) < 2 {
			continue
		}
		switch fields[0] {
		case "Threads:":
			threads, _ = strconv.Atoi(fields[1])
		case "VmRSS:":
			rssKB, _ = strconv.ParseInt(fields[1], 10, 64)
		}
	}
	return threads, rssKB
}

// srsReachable pings the local SRS HTTP API with a short timeout.
func srsReachable(ctx context.Context) bool {
	cl := &http.Client{Timeout: 1500 * time.Millisecond}
	req, err := http.NewRequestWithContext(ctx, "GET", "http://127.0.0.1:1985/api/v1/versions", nil)
	if err != nil {
		return false
	}
	res, err := cl.Do(req)
	if err != nil {
		return false
	}
	defer res.Body.Close()
	return res.StatusCode == http.StatusOK
}

// countFfmpegProcesses counts running FFmpeg processes (one per active forward).
func countFfmpegProcesses() int {
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return 0
	}
	n := 0
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		if _, err := strconv.Atoi(e.Name()); err != nil {
			continue // not a pid dir
		}
		b, err := os.ReadFile(path.Join("/proc", e.Name(), "comm"))
		if err != nil {
			continue
		}
		if strings.TrimSpace(string(b)) == "ffmpeg" {
			n++
		}
	}
	return n
}
