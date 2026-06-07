# Getting started

## The interface
Navigate with the **left sidebar** — **Channels · Destinations · Ingest** (and
**Users · System** for owners). The top bar shows the app name, your account, and
a **light/dark toggle** (also in the sidebar footer); the app follows your system
theme by default and remembers your choice. On narrow screens / phones the sidebar
collapses to a **☰ menu** button. Sign out from the account menu (top right).

## Signing in & roles
Open `https://<your-host>/mgmt`.

- **Microsoft sign-in (Entra ID):** click **Continue with Microsoft**. Only
  registered users can get in; unregistered accounts see an "access denied" page.
  *(A **Continue with Google** button is shown but not yet active — use Microsoft.)*
- **Password:** if Entra isn't enabled for your deployment, sign in with the
  management password.

**Roles**

| Role | Access |
|------|--------|
| **Owner** | Full access, including **Users** management, **System** health, and owner-only controls (rotating the publish key, the SRT-encryption toggle). |
| **Editor** | Day-to-day operation: **Channels** (incl. **Monitor**), **Destinations**, **Ingest**. Owner-only controls are hidden. |

## Quick start: publish your first stream
1. **Channels** → **+ Add Channel** → give it a label and a **Stream name**
   (e.g. `sunday-service`).
2. Expand the channel (**Manage**) → **Ingest URLs** → copy the **SRT** or
   **RTMP** URL.
3. In your encoder (OBS, Teradek, Haivision…), paste the URL and set
   **keyframe interval = 2s**, **H.264**, **CBR**. Start streaming.
4. On the channel, click **Monitor** → the source shows **HEALTHY** with a live
   preview within a few seconds.
5. Back in the channel → **Add Destination** (e.g. YouTube) → **Start**. Your
   stream is now live on that destination.

!!! tip
    See the **[Encoder settings](encoder-settings.md)** cheat-sheet for exact OBS
    and hardware-encoder configuration.
