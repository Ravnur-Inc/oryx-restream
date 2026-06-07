# System health

*(Owner only.)* The **System** tab is a live at-a-glance health panel (refreshes
every 5s):

- **Host** — **CPU load**, **memory**, and **disk** usage (bars turn amber/red as
  usage climbs).
- **Application** — whether the **SRS media server** is up, the number of active
  **FFmpeg forwards**, goroutines/OS threads, platform memory, and host/process
  **uptime**.

It's a snapshot, not a history.

!!! tip "History & alerting"
    For graphs, alerting, and email notifications, enable **Azure Monitor** on the
    VM — it's managed (nothing to run on the box) and covers CPU/memory/disk plus
    alert rules. See the
    [deployment guide → Monitoring](https://github.com/Ravnur-Inc/oryx-restream/blob/main/deploy/azure-vm/README.md#monitoring).
