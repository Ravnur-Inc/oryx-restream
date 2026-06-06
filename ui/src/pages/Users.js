//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
import React from "react";
import axios from "axios";
import {Token} from "../utils";
import {SrsErrorBoundary} from "../components/SrsErrorBoundary";
import {useToast} from "../components/useToast";
import {ACCENT, ACCENT_SOFT, ACCENT_ON_SOFT, CARD, PANEL, BORDER, HEADING, BODY, SECOND, MUTED, DANGER, mono, syne} from "../components/tokens";

export default function Users() {
  return (
    <SrsErrorBoundary>
      <UsersImpl/>
    </SrsErrorBoundary>
  );
}

// ── Design tokens (matches ForwardManager) ────────────────────────────────────

const inputBase = {
  ...mono, fontSize: 13, color: BODY,
  background: CARD, border: `1.5px solid ${BORDER}`,
  borderRadius: 5, outline: "none", transition: "border-color 0.15s",
  width: "100%",
};

// ── Shared components ─────────────────────────────────────────────────────────
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

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({status}) {
  const active = status === "active";
  const s = active
    ? {color: "#15803d", bg: "rgba(21,128,61,0.09)", bd: "rgba(21,128,61,0.30)", label: "● ACTIVE"}
    : {color: "#b45309", bg: "rgba(180,83,9,0.10)",  bd: "rgba(180,83,9,0.32)",  label: "○ INVITED"};
  return (
    <span title={active ? "Has signed in" : "Invited — awaiting first sign-in"} style={{
      ...mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
      color: s.color, background: s.bg, border: `1px solid ${s.bd}`,
      padding: "2px 7px", borderRadius: 3, whiteSpace: "nowrap",
    }}>{s.label}</span>
  );
}

const iconBtn = {
  background: "none", border: "1px solid transparent", color: SECOND,
  cursor: "pointer", fontSize: 15, padding: "3px 6px", lineHeight: 1,
  borderRadius: 4, transition: "all 0.15s",
};

// ── User row card ─────────────────────────────────────────────────────────────
function UserCard({user, onEdit, onDelete, onResend, onCancel}) {
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const isOwner = user.role === 'owner';
  const invited = user.status === 'invited';

  return (
    <article style={{
      background: CARD,
      borderRadius: 8,
      padding: "18px 22px",
      border: `1px solid ${BORDER}`,
      borderLeft: `3px solid ${isOwner ? ACCENT : "#c8c4be"}`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div className="card-header">
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{...syne, fontWeight: 700, fontSize: 14, color: HEADING, marginBottom: 2}}>
            {user.firstName} {user.lastName}
          </div>
          <div style={{...mono, fontSize: 11, color: MUTED}}>
            {user.email}
          </div>
        </div>

        <div className="card-actions">
          <span style={{
            ...mono, fontSize: 10, letterSpacing: "0.08em",
            color: isOwner ? ACCENT_ON_SOFT : SECOND,
            background: isOwner ? ACCENT_SOFT : PANEL,
            border: `1px solid ${isOwner ? "transparent" : BORDER}`,
            padding: "2px 8px", borderRadius: 3,
          }}>
            {user.role.toUpperCase()}
          </span>

          <StatusBadge status={user.status}/>

          {invited ? (
            <>
              <Btn variant="dim" small onClick={() => onResend(user)}>Resend</Btn>
              <Btn variant="danger" small onClick={() => setConfirmCancel(true)}>Cancel</Btn>
              <button onClick={() => onEdit(user)} aria-label={`Edit ${user.email}`} style={iconBtn}
                onMouseEnter={e => {e.currentTarget.style.color = HEADING; e.currentTarget.style.background = PANEL; e.currentTarget.style.borderColor = BORDER;}}
                onMouseLeave={e => {e.currentTarget.style.color = SECOND;  e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "transparent";}}>✎</button>
            </>
          ) : (
            <>
              {user.lastLoginAt && (
                <span title="Last sign-in" style={{...mono, fontSize: 10, color: MUTED}}>
                  seen {new Date(user.lastLoginAt).toLocaleDateString()}
                </span>
              )}
              <button onClick={() => onEdit(user)} aria-label={`Edit ${user.firstName} ${user.lastName}`} style={iconBtn}
                onMouseEnter={e => {e.currentTarget.style.color = HEADING; e.currentTarget.style.background = PANEL; e.currentTarget.style.borderColor = BORDER;}}
                onMouseLeave={e => {e.currentTarget.style.color = SECOND;  e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "transparent";}}>✎</button>
              <button onClick={() => setConfirmDel(true)} aria-label={`Delete ${user.firstName} ${user.lastName}`} style={iconBtn}
                onMouseEnter={e => {e.currentTarget.style.color = DANGER; e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = "#fca5a5";}}
                onMouseLeave={e => {e.currentTarget.style.color = SECOND; e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "transparent";}}>✕</button>
            </>
          )}
        </div>
      </div>

      {confirmDel && (
        <div role="alertdialog" aria-label="Confirm deletion" style={{
          marginTop: 14, padding: "14px 16px", borderRadius: 6,
          background: "#fef2f2", border: "1px solid #fca5a5",
        }}>
          <div style={{...syne, fontSize: 13, color: DANGER, marginBottom: 10}}>
            Delete {user.firstName} {user.lastName} ({user.email})? This cannot be undone.
          </div>
          <div style={{display: "flex", gap: 8}}>
            <Btn variant="ghost" small onClick={() => setConfirmDel(false)}>Cancel</Btn>
            <Btn variant="danger" small onClick={() => {setConfirmDel(false); onDelete(user);}}>Delete</Btn>
          </div>
        </div>
      )}

      {confirmCancel && (
        <div role="alertdialog" aria-label="Confirm cancel invite" style={{
          marginTop: 14, padding: "14px 16px", borderRadius: 6,
          background: "#fef2f2", border: "1px solid #fca5a5",
        }}>
          <div style={{...syne, fontSize: 13, color: DANGER, marginBottom: 10}}>
            Cancel the invite for {user.email}? They'll be removed and the sign-in link will stop working.
          </div>
          <div style={{display: "flex", gap: 8}}>
            <Btn variant="ghost" small onClick={() => setConfirmCancel(false)}>Keep</Btn>
            <Btn variant="danger" small onClick={() => {setConfirmCancel(false); onCancel(user);}}>Cancel invite</Btn>
          </div>
        </div>
      )}
    </article>
  );
}

// ── Invite-link modal (shown when an invite email can't be sent) ──────────────
function InviteLinkModal({info, onClose}) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(info.link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  React.useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Invite link" onClick={e => e.target === e.currentTarget && onClose()}
      style={{position: "fixed", inset: 0, background: "rgba(43,41,38,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)"}}>
      <div style={{background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "28px 32px", width: 560, maxWidth: "92vw", boxShadow: "0 24px 60px rgba(0,0,0,0.18)"}}>
        <div style={{display: "flex", alignItems: "center", gap: 12, marginBottom: 14}}>
          <div style={{width: 5, height: 28, background: ACCENT, borderRadius: 3}}/>
          <span style={{...syne, fontWeight: 800, fontSize: 18, color: HEADING}}>Invite created — send the link</span>
        </div>
        <div style={{fontSize: 13, color: SECOND, marginBottom: 16}}>
          {info.reason} Share this sign-in link with <b>{info.email}</b> — they sign in with their Microsoft account.
        </div>
        <div style={{...mono, fontSize: 12, color: BODY, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "10px 12px", wordBreak: "break-all", marginBottom: 16}}>
          {info.link}
        </div>
        <div style={{display: "flex", gap: 10, justifyContent: "flex-end"}}>
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
          <Btn variant="primary" onClick={copy}>{copied ? "Copied ✓" : "Copy link"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
const ROLES = ['owner', 'editor'];
const emptyForm = {firstName: '', lastName: '', email: '', role: 'editor', invite: true};

// The app's externally-reachable base URL (origin + PUBLIC_URL), used as the
// sign-in link shown when an invite email can't be sent.
const appBaseUrl = () => `${window.location.origin}${window.PUBLIC_URL || ''}`;

function UserModal({initial, onSave, onClose, saving}) {
  const [form, setForm] = React.useState(initial
    ? {firstName: initial.firstName, lastName: initial.lastName, email: initial.email, role: initial.role}
    : emptyForm
  );
  const set = (k) => (e) => setForm(f => ({...f, [k]: e.target.value}));
  const valid = form.firstName.trim() && form.lastName.trim() && form.email.trim();

  React.useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={initial ? "Edit user" : "New user"}
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, background: "rgba(43,41,38,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 200, backdropFilter: "blur(4px)",
      }}>
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10,
        padding: "32px 36px", width: 500, maxWidth: "92vw",
        boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
      }}>
        <div style={{display: "flex", alignItems: "center", gap: 12, marginBottom: 28}}>
          <div style={{width: 5, height: 28, background: ACCENT, borderRadius: 3}}/>
          <span style={{...syne, fontWeight: 800, fontSize: 18, color: HEADING}}>
            {initial ? "Edit User" : "New User"}
          </span>
        </div>

        {[
          {label: "First Name", key: "firstName", ph: "Jane",              type: "text"},
          {label: "Last Name",  key: "lastName",  ph: "Smith",             type: "text"},
          {label: "Email",      key: "email",     ph: "jane@example.com",  type: "email"},
        ].map(({label, key, ph, type}) => (
          <div key={key} style={{marginBottom: 18}}>
            <label
              htmlFor={`field-${key}`}
              style={{
                display: "block", ...mono, fontSize: 10, color: MUTED,
                letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7,
              }}>{label}</label>
            <input
              id={`field-${key}`}
              type={type}
              style={{...inputBase, padding: "9px 12px"}}
              placeholder={ph}
              value={form[key]}
              onChange={set(key)}
              onFocus={e => (e.target.style.borderColor = ACCENT)}
              onBlur={e  => (e.target.style.borderColor = BORDER)}
            />
          </div>
        ))}

        <div style={{marginBottom: 28}}>
          <label
            htmlFor="field-role"
            style={{
              display: "block", ...mono, fontSize: 10, color: MUTED,
              letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7,
            }}>Role</label>
          <div style={{display: "flex", gap: 8}}>
            {ROLES.map(r => (
              <button
                key={r}
                onClick={() => setForm(f => ({...f, role: r}))}
                style={{
                  ...syne, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em",
                  padding: "7px 20px", borderRadius: 5, cursor: "pointer",
                  border: "1.5px solid",
                  background:  form.role === r ? ACCENT       : "transparent",
                  color:       form.role === r ? "#ffffff"    : SECOND,
                  borderColor: form.role === r ? ACCENT       : BORDER,
                  transition: "all 0.15s",
                }}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {!initial && (
          <label style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 24, cursor: "pointer", ...mono, fontSize: 12, color: SECOND}}>
            <input
              type="checkbox"
              checked={form.invite}
              onChange={e => setForm(f => ({...f, invite: e.target.checked}))}
              style={{width: 16, height: 16, accentColor: ACCENT, cursor: "pointer"}}
            />
            Send an invite email with a sign-in link
          </label>
        )}

        <div style={{display: "flex", gap: 10, justifyContent: "flex-end"}}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!valid || saving} onClick={() => valid && onSave(form)}>
            {saving ? "Saving…" : (initial ? "Save User" : (form.invite ? "Create & Invite" : "Create User"))}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────
function UsersImpl() {
  const [users,   setUsers]   = React.useState([]);
  const [modal,   setModal]   = React.useState(null); // null | {mode:'add'} | {mode:'edit', user}
  const [saving,  setSaving]  = React.useState(false);
  const [inviteInfo, setInviteInfo] = React.useState(null); // {email, link, reason} when email can't be sent
  const {showError, showOk, Toaster} = useToast();

  // Build the "email couldn't be sent" reason + show the copyable link modal.
  const fallbackToLink = React.useCallback((email, data) => {
    const reason = !data?.smtpConfigured
      ? "Email isn't configured on the server, so no message was sent."
      : `The invite email couldn't be sent${data?.emailError ? ` (${data.emailError})` : ""}.`;
    setInviteInfo({email, link: appBaseUrl(), reason});
  }, []);

  const loadUsers = React.useCallback(() => {
    axios.post('/terraform/v1/mgmt/users', {}, {
      headers: Token.loadBearerHeader(),
    }).then(res => {
      setUsers(res.data.data || []);
    }).catch(showError);
  }, [showError]);

  React.useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleSave = (form) => {
    if (!form.firstName.trim()) return showError('First name is required.');
    if (!form.lastName.trim())  return showError('Last name is required.');
    if (!form.email.trim())     return showError('Email is required.');
    if (!ROLES.includes(form.role)) return showError('Role must be owner or editor.');

    const creating = !modal.user;
    setSaving(true);
    const payload = {
      action: creating ? 'create' : 'update',
      ...(creating ? {} : {id: modal.user.id}),
      callerEmail: Token.loadUser()?.email || '',
      firstName: form.firstName.trim(),
      lastName:  form.lastName.trim(),
      email:     form.email.trim(),
      role:      form.role,
      ...(creating ? {invite: !!form.invite} : {}),
    };

    axios.post('/terraform/v1/mgmt/users', payload, {
      headers: Token.loadBearerHeader(),
    }).then((res) => {
      setModal(null);
      loadUsers();
      if (creating) {
        const data = res.data?.data || {};
        if (!form.invite) {
          showOk(`${data.email || form.email.trim()} added.`);
        } else if (data.emailSent) {
          showOk(`Invite emailed to ${data.email || form.email.trim()}.`);
        } else {
          fallbackToLink(data.email || form.email.trim(), data);
        }
      }
    }).catch(showError).finally(() => setSaving(false));
  };

  const handleDelete = (user) => {
    axios.post('/terraform/v1/mgmt/users', {
      action: 'delete',
      id: user.id,
      callerEmail: Token.loadUser()?.email || '',
    }, {headers: Token.loadBearerHeader()}).then(loadUsers).catch(showError);
  };

  const handleResend = (user) => {
    axios.post('/terraform/v1/mgmt/users', {
      action: 'invite-resend',
      id: user.id,
      callerEmail: Token.loadUser()?.email || '',
    }, {headers: Token.loadBearerHeader()}).then((res) => {
      const data = res.data?.data || {};
      if (data.emailSent) showOk(`Invite re-sent to ${user.email}.`);
      else fallbackToLink(user.email, data);
    }).catch(showError);
  };

  const handleCancel = (user) => {
    axios.post('/terraform/v1/mgmt/users', {
      action: 'invite-cancel',
      id: user.id,
      callerEmail: Token.loadUser()?.email || '',
    }, {headers: Token.loadBearerHeader()}).then(() => {
      showOk(`Invite for ${user.email} cancelled.`);
      loadUsers();
    }).catch(showError);
  };

  const owners  = users.filter(u => u.role === 'owner').length;
  const editors = users.filter(u => u.role === 'editor').length;
  const pending = users.filter(u => u.status === 'invited').length;

  return (
    <div style={{maxWidth: 820, margin: "0 auto", ...syne}}>
      {Toaster}

      <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 14, flexWrap: "wrap"}}>
        <div style={{display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap"}}>
          <span style={{...syne, fontWeight: 800, fontSize: 20, color: HEADING}}>Users</span>
          {[
            ["TOTAL",   users.length],
            ["OWNERS",  owners],
            ["EDITORS", editors],
            ["PENDING", pending],
          ].map(([k, v]) => (
            <div key={k} style={{display: "flex", alignItems: "center", gap: 7}}>
              <span style={{...mono, fontSize: 10, color: MUTED, letterSpacing: "0.1em"}}>{k}</span>
              <span style={{...mono, fontSize: 15, fontWeight: 600, color: v > 0 ? ACCENT : SECOND}}>{v}</span>
            </div>
          ))}
        </div>
        <Btn variant="primary" onClick={() => setModal({mode: 'add'})}>+ Add User</Btn>
      </div>

      {/* ── Body ── */}
      <div>
        {users.length === 0 ? (
          <div style={{textAlign: "center", padding: "56px 24px"}}>
            <div aria-hidden="true" style={{fontSize: 40, marginBottom: 14, color: BORDER}}>⬡</div>
            <div style={{...syne, fontSize: 15, color: SECOND, marginBottom: 6}}>No users yet</div>
            <div style={{fontSize: 12, color: MUTED, marginBottom: 20}}>Add the first user to grant access to this application</div>
            <Btn variant="primary" onClick={() => setModal({mode: 'add'})}>+ Add User</Btn>
          </div>
        ) : (
          <div style={{display: "flex", flexDirection: "column", gap: 10}}>
            {users.map(user => (
              <UserCard
                key={user.id}
                user={user}
                onEdit={(u) => setModal({mode: 'edit', user: u})}
                onDelete={handleDelete}
                onResend={handleResend}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </div>

      {modal && (
        <UserModal
          initial={modal.user}
          saving={saving}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {inviteInfo && (
        <InviteLinkModal info={inviteInfo} onClose={() => setInviteInfo(null)}/>
      )}
    </div>
  );
}
