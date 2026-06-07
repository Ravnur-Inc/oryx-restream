# Users & invites

*(Owner only.)* The **Users** tab manages who can sign in with Microsoft. Access
is granted by **email** — a user signs in with the Microsoft account matching the
email you add here.

- **+ Add User** — first name, last name, **email** (their Microsoft sign-in
  address), **role** (owner/editor), and **Send an invite email** (on by default).
- **Invite email** — if email is configured on the server, the new user is emailed
  a sign-in link. If email **isn't** configured (or sending fails), you get a
  **copyable sign-in link** to send them yourself — the invite still works either
  way.

## Status
| Status | Meaning |
|--------|---------|
| **○ INVITED** | Added but hasn't signed in yet. You can **Resend** the invite or **Cancel** it (removes the pending user). |
| **● ACTIVE** | Has signed in at least once (shows last sign-in date). Status flips automatically on their first sign-in. |

Owners can edit users and delete active ones; you can't delete your own account.

!!! note "Enabling invite emails"
    Set `SMTP_HOST` + `SMTP_FROM` (and usually `SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`)
    on the server, plus `MGMT_BASE_URL` (the public mgmt URL used in the link). See
    the [deployment guide](https://github.com/Ravnur-Inc/oryx-restream/blob/main/deploy/azure-vm/README.md#invite-emails-optional-smtp).
    Without SMTP, invites fall back to the copyable link.
