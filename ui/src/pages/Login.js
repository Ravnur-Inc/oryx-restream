//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
// Sign-in screen. Two-column split: an SSO form on the left and an always-dark
// branded "simulcast routing" panel on the right (hidden below 880px). Auth is
// SSO-only — Microsoft Entra (MSAL popup) and Google (OAuth auth-code popup).
// The Google button appears only when the server reports a googleClientId in
// /envs. Built from the design handoff (design_handoff_login).
import React from "react";
import {
  Box, Button, Title, Text, Anchor, Divider, Group, Stack, Paper, ThemeIcon,
  SegmentedControl, useMantineColorScheme,
} from "@mantine/core";
import {
  IconChevronRight, IconShieldCheck, IconSun, IconMoon, IconDeviceDesktop,
  IconBroadcast,
} from "@tabler/icons-react";
import {GoogleOAuthProvider, useGoogleLogin} from "@react-oauth/google";
import axios from "axios";
import {useNavigate} from "react-router-dom";
import {Token, Tools} from "../utils";
import {SrsErrorBoundary} from "../components/SrsErrorBoundary";
import {SrsEnvContext} from "../components/SrsEnvContext";
import {useErrorBoundary} from "react-error-boundary";
import {apiError} from "../components/useToast";
import {msalInstance, loginRequest} from "../msalInstance";
import ravnurLogo from "../resources/ravnur-logo.svg";

const FONT = "'Public Sans', system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const MONO = "ui-monospace, Menlo, Monaco, Consolas, monospace";

export default function Login({onLogin}) {
  return (
    <SrsErrorBoundary>
      <LoginImpl onLogin={onLogin} />
    </SrsErrorBoundary>
  );
}

// Microsoft four-square mark (matches the app's other Microsoft logo usage).
function MicrosoftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="20" height="20"
      viewBox="0 0 256 256" style={{display: "block", flexShrink: 0}}>
      <path fill="#f1511b" d="M121.666 121.666H0V0h121.666z"/>
      <path fill="#80cc28" d="M256 121.666H134.335V0H256z"/>
      <path fill="#00adef" d="M121.663 256.002H0V134.336h121.663z"/>
      <path fill="#fbbc09" d="M256 256.002H134.335V134.336H256z"/>
    </svg>
  );
}

// Google "G" multicolor mark.
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" style={{display: "block", flexShrink: 0}}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

// One SSO provider button: [icon] [label, left-aligned, grows] [chevron].
function SsoButton({icon, label, onClick, loading, disabled}) {
  return (
    <Button
      type="button"
      variant="default"
      fullWidth
      h={52}
      onClick={onClick}
      loading={loading}
      disabled={disabled}
      className="login-sso"
      leftSection={icon}
      rightSection={<IconChevronRight size={18} className="login-sso__chev"/>}
      styles={{
        root: {
          fontFamily: FONT, fontSize: 15, fontWeight: 600,
          paddingInline: 18, borderWidth: 1,
        },
        label: {flex: 1, textAlign: "left"},
      }}
    >
      {label}
    </Button>
  );
}

// The Google provider button. Must render inside <GoogleOAuthProvider>; the
// auth-code popup flow hands back a code (no ID token in the browser) that the
// backend exchanges. Reports the code (or an error) to the parent via onCode.
function GoogleSsoButton({onCode, loading, disabled}) {
  const login = useGoogleLogin({
    flow: "auth-code",
    onSuccess: (resp) => onCode(resp.code),
    onError: () => onCode(null, "Google sign-in failed. Please try again."),
  });
  return (
    <SsoButton
      icon={<GoogleIcon/>}
      label="Continue with Google"
      onClick={() => login()}
      loading={loading}
      disabled={disabled}
    />
  );
}

function ThemeToggle() {
  const {colorScheme, setColorScheme} = useMantineColorScheme();
  return (
    <SegmentedControl
      size="xs"
      radius="xl"
      value={colorScheme}
      onChange={setColorScheme}
      aria-label="Color theme"
      data={[
        {value: "light", label: <IconSun size={15}/>},
        {value: "auto", label: <IconDeviceDesktop size={15}/>},
        {value: "dark", label: <IconMoon size={15}/>},
      ]}
    />
  );
}

function LoginImpl({onLogin}) {
  // Which provider's sign-in is in flight: 'microsoft' | 'google' | null.
  const [loadingProvider, setLoadingProvider] = React.useState(null);
  // Inline notice below the buttons: {type: 'error' | 'info', text} | null.
  const [notice, setNotice] = React.useState(null);
  const navigate = useNavigate();
  const {showBoundary: handleError} = useErrorBoundary();
  // Server config (from /envs). Google sign-in is enabled when googleClientId is set.
  const env = React.useContext(SrsEnvContext)?.[0];
  const googleClientId = env?.googleClientId;

  // Verify an existing token on load — if valid, skip the login page.
  React.useEffect(() => {
    const token = Token.load();
    if (!token || !token.token) return;

    console.log(`Login: Verify, token is ${Tools.mask(token)}`);
    axios.post('/terraform/v1/mgmt/token', {...token}).then(res => {
      axios.post('/terraform/v1/mgmt/token', {}, {
        headers: Token.loadBearerHeader(),
      }).then(res => {
        console.log(`Login: Done, token is ${Tools.mask(token)}`);
        navigate('/routers-channels');
      });
    }).catch(handleError);
  }, [navigate, handleError]);

  // Sign in with Microsoft Entra — popup flow.
  const handleEntraLogin = React.useCallback(async () => {
    setLoadingProvider('microsoft');
    setNotice(null);
    try {
      const result = await msalInstance.loginPopup(loginRequest);
      const idToken = result.idToken;

      const res = await axios.post('/terraform/v1/mgmt/auth/entra', {entraToken: idToken});
      const data = res.data.data;
      console.log(`Login: Entra ok, user=${data.user?.email}, role=${data.user?.role}`);
      Token.save(data);
      onLogin && onLogin();
      navigate('/routers-channels');
    } catch (err) {
      if (err?.errorCode === 'user_cancelled' || err?.errorCode === 'popup_window_error') return;
      const msg = apiError(err);
      if (msg.includes('not authorized')) {
        navigate('/routers-forbidden');
        return;
      }
      setNotice({type: 'error', text: msg || 'Sign-in failed. Please try again.'});
    } finally {
      setLoadingProvider(null);
    }
  }, [onLogin, navigate]);

  // Sign in with Google — the popup returns an auth code, which the backend
  // exchanges for the user's verified email. (code === null means the user
  // closed the popup or the SDK errored; errText carries an optional message.)
  const handleGoogleCode = React.useCallback(async (code, errText) => {
    if (!code) {
      if (errText) setNotice({type: 'error', text: errText});
      return;
    }
    setLoadingProvider('google');
    setNotice(null);
    try {
      const res = await axios.post('/terraform/v1/mgmt/auth/google', {code});
      const data = res.data.data;
      console.log(`Login: Google ok, user=${data.user?.email}, role=${data.user?.role}`);
      Token.save(data);
      onLogin && onLogin();
      navigate('/routers-channels');
    } catch (err) {
      const msg = apiError(err);
      if (msg.includes('not authorized')) {
        navigate('/routers-forbidden');
        return;
      }
      setNotice({type: 'error', text: msg || 'Sign-in failed. Please try again.'});
    } finally {
      setLoadingProvider(null);
    }
  }, [onLogin, navigate]);

  const busy = loadingProvider !== null;

  return (
    <Box className="login-shell" style={{position: "fixed", inset: 0, zIndex: 9999, fontFamily: FONT}}>

      {/* ── Left: SSO form ── */}
      <Box
        component="main"
        className="login-auth"
        style={{
          position: "relative",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "48px 40px",
          background: "var(--mantine-color-body)",
        }}
      >
        <Box className="login-auth__inner" style={{width: "100%", maxWidth: 400}}>
          {/* Brand lockup */}
          <Group gap={12} mb={44} wrap="nowrap">
            <img src={ravnurLogo} alt="Ravnur" style={{width: 40, height: 40, display: "block"}}/>
            <Box>
              <Text fw={800} fz={18} lh={1.1} style={{letterSpacing: "-0.01em"}}>Simulcast Manager</Text>
              <Text fw={600} fz={11.5} c="dimmed" mt={3}
                style={{letterSpacing: "0.14em", textTransform: "uppercase"}}>Ravnur</Text>
            </Box>
          </Group>

          {/* Heading */}
          <Title order={1} fz={28} fw={800} lh={1.15} mb={10} style={{letterSpacing: "-0.02em"}}>
            Sign in to your workspace
          </Title>
          <Text c="dimmed" fz={15} lh={1.55}>
            Route your live contribution feeds to every destination from one place.
            Continue with your organization account.
          </Text>

          {/* Provider buttons */}
          <Stack gap={12} mt={32}>
            <SsoButton
              icon={<MicrosoftIcon/>}
              label="Continue with Microsoft"
              onClick={handleEntraLogin}
              loading={loadingProvider === 'microsoft'}
              disabled={busy && loadingProvider !== 'microsoft'}
            />
            {googleClientId && (
              <GoogleOAuthProvider clientId={googleClientId}>
                <GoogleSsoButton
                  onCode={handleGoogleCode}
                  loading={loadingProvider === 'google'}
                  disabled={busy && loadingProvider !== 'google'}
                />
              </GoogleOAuthProvider>
            )}
          </Stack>

          {/* Inline notice (sign-in errors) */}
          {notice && (
            <Text
              mt={14} fz={13} role={notice.type === 'error' ? 'alert' : 'status'}
              c={notice.type === 'error' ? 'red' : 'dimmed'}
            >
              {notice.text}
            </Text>
          )}

          {/* Divider */}
          <Divider
            my={26}
            label="Single sign-on"
            labelPosition="center"
            styles={{label: {
              fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em",
              textTransform: "uppercase", color: "var(--mantine-color-dimmed)",
            }}}
          />

          {/* SSO note */}
          <Paper withBorder radius="md" p="md" bg="var(--mantine-color-default)">
            <Group gap={11} align="flex-start" wrap="nowrap">
              <ThemeIcon variant="transparent" color="gray" size={18} style={{marginTop: 1}}>
                <IconShieldCheck size={16}/>
              </ThemeIcon>
              <Text c="dimmed" fz={13} lh={1.5}>
                Access is managed by your identity provider. Use the same account you use for
                your organization — no separate password required.
              </Text>
            </Group>
          </Paper>

          {/* Legal */}
          <Text mt={34} fz={12.5} c="dimmed" lh={1.6}>
            By continuing you agree to Ravnur's{" "}
            <Anchor href="#" c="dimmed" onClick={(e) => e.preventDefault()} style={{textUnderlineOffset: 3}}>
              Terms of Service
            </Anchor>{" "}
            and{" "}
            <Anchor href="#" c="dimmed" onClick={(e) => e.preventDefault()} style={{textUnderlineOffset: 3}}>
              Privacy Policy
            </Anchor>.
          </Text>
        </Box>

        {/* Footer: copyright + theme toggle */}
        <Group
          justify="space-between" align="center"
          style={{position: "absolute", left: 0, right: 0, bottom: 0, padding: "20px 40px"}}
        >
          <Text fz={12.5} c="dimmed">© 2026 Ravnur, Inc.</Text>
          <ThemeToggle/>
        </Group>
      </Box>

      {/* ── Right: branded panel (hidden ≤880px via .login-panel) ── */}
      <BrandedPanel/>
    </Box>
  );
}

// Destination chips shown in the routing diagram. Panel is always-dark, so the
// platform brand colors are intentionally hardcoded.
const DESTINATIONS = [
  {name: "YouTube", sub: "rtmp · 1080p", bg: "#FF0000", glyph: "▶"},
  {name: "Facebook Live", sub: "rtmps · 720p", bg: "#1877F2", glyph: "f"},
  {name: "Twitch", sub: "rtmp · 1080p", bg: "#9146FF", glyph: "tw"},
  {name: "Custom RTMP", sub: "rtmp · 1080p", bg: "#475569", glyph: <IconBroadcast size={15} color="#fff"/>},
];

// A monospace ingest-protocol pill in the source card. `highlight` tints it the
// brand green to call out SRT as a first-class (non-premium) protocol.
function ProtoBadge({label, highlight}) {
  return (
    <Text
      style={{
        fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
        lineHeight: 1, padding: "4px 7px", borderRadius: 6,
        background: highlight ? "rgba(167,216,64,.16)" : "rgba(8,12,18,.7)",
        border: `1px solid ${highlight ? "rgba(167,216,64,.55)" : "rgba(255,255,255,.16)"}`,
        color: highlight ? "#cde89a" : "#cdd9e6",
      }}
    >
      {label}
    </Text>
  );
}

function BrandedPanel() {
  return (
    <Box
      component="aside"
      className="login-panel"
      aria-hidden="true"
      style={{
        position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: 56, color: "#eaf2fb",
        background:
          "radial-gradient(120% 90% at 85% 8%, rgba(55,144,208,.30) 0%, rgba(55,144,208,0) 55%)," +
          "radial-gradient(90% 80% at 12% 95%, rgba(167,216,64,.20) 0%, rgba(167,216,64,0) 55%)," +
          "linear-gradient(155deg, #14233a 0%, #0e1722 70%)",
      }}
    >
      {/* Watermark chevrons */}
      <svg viewBox="0 0 100 100" aria-hidden="true" style={{
        position: "absolute", right: -80, top: -60, width: 520, height: 520,
        opacity: 0.06, pointerEvents: "none", transform: "rotate(-8deg)",
      }}>
        <path d="M5 20 L45 50 L5 80 Z" fill="#a7d840"/>
        <path d="M50 20 L90 50 L50 80 Z" fill="#3790d0"/>
      </svg>

      {/* Live tag pill */}
      <Group gap={9} wrap="nowrap" style={{
        position: "relative", zIndex: 2, alignSelf: "flex-start",
        padding: "7px 14px", borderRadius: 999,
        background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)",
        backdropFilter: "blur(6px)",
      }}>
        <span className="login-dot"/>
        <Text fz={12.5} fw={600} c="#cfe2f4" style={{letterSpacing: "0.04em"}}>
          LIVE · 4 destinations streaming
        </Text>
      </Group>

      {/* Headline */}
      <Box style={{position: "relative", zIndex: 2, maxWidth: 460}}>
        <Title order={2} c="#fff" fz={38} fw={800} lh={1.1} mb={16}
          style={{letterSpacing: "-0.025em", textWrap: "balance"}}>
          One contribution feed. Every audience.
        </Title>
        <Text fz={16} lh={1.6} c="#aebfd2">
          Ingest a single live stream over{" "}
          <Text span fw={700} c="#cde89a" inherit>RTMP or SRT</Text>{" "}
          and restream it simultaneously to YouTube, Facebook Live, Twitch or any
          custom RTMP target.
        </Text>
      </Box>

      {/* Routing diagram */}
      <Box style={{position: "relative", zIndex: 2, margin: "38px 0"}}>
        <Box style={{display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center"}}>
          {/* Source card */}
          <Box style={{
            borderRadius: 14, padding: 14, backdropFilter: "blur(6px)",
            background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)",
          }}>
            <Box style={{
              position: "relative", height: 104, borderRadius: 9, overflow: "hidden",
              display: "grid", placeItems: "center", backgroundColor: "#0b1320",
              backgroundImage: "repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 10px,rgba(255,255,255,0) 10px 20px)",
            }}>
              <Group gap={6} wrap="nowrap" style={{
                position: "absolute", top: 9, left: 9, padding: "4px 8px", borderRadius: 6,
                background: "rgba(8,12,18,.7)", border: "1px solid rgba(255,255,255,.14)",
              }}>
                <span className="login-dot"/>
                <Text fz={10.5} fw={700} c="#fff" style={{letterSpacing: "0.08em"}}>LIVE</Text>
              </Group>
              {/* Ingest-protocol badges: SRT highlighted as a first-class protocol. */}
              <Group gap={5} wrap="nowrap" style={{position: "absolute", top: 9, right: 9}}>
                <ProtoBadge label="RTMP"/>
                <ProtoBadge label="SRT" highlight/>
              </Group>
              <Text style={{fontFamily: MONO}} fz={11} c="#7e93ab">contribution feed</Text>
            </Box>
            <Group justify="space-between" mt={11} wrap="nowrap">
              <Text fz={13} fw={700} c="#eaf2fb">RTMP or SRT ingest</Text>
              <Text style={{fontFamily: MONO}} fz={11} c="#8aa0b8">1080p · 6.0 Mbps</Text>
            </Group>
          </Box>

          {/* Flow connector */}
          <svg width={96} height={236} viewBox="0 0 96 236" preserveAspectRatio="none"
            aria-hidden="true" style={{flex: "none"}}>
            {["M0 118 C48 118, 48 30, 96 30",
              "M0 118 C48 118, 48 89, 96 89",
              "M0 118 C48 118, 48 148, 96 148",
              "M0 118 C48 118, 48 207, 96 207"].map((d, i) => (
              <path key={i} d={d} fill="none" stroke="rgba(174,191,210,.35)" strokeWidth={1.6}/>
            ))}
            <path className="login-spark" d="M0 118 C48 118, 48 30, 96 30" strokeDasharray="14 210">
              <animate attributeName="stroke-dashoffset" from="224" to="0" dur="2.6s" repeatCount="indefinite"/>
            </path>
            <path className="login-spark" d="M0 118 C48 118, 48 89, 96 89" strokeDasharray="14 160">
              <animate attributeName="stroke-dashoffset" from="174" to="0" dur="2.6s" begin="0.45s" repeatCount="indefinite"/>
            </path>
            <path className="login-spark" d="M0 118 C48 118, 48 148, 96 148" strokeDasharray="14 160">
              <animate attributeName="stroke-dashoffset" from="174" to="0" dur="2.6s" begin="0.9s" repeatCount="indefinite"/>
            </path>
            <path className="login-spark" d="M0 118 C48 118, 48 207, 96 207" strokeDasharray="14 210">
              <animate attributeName="stroke-dashoffset" from="224" to="0" dur="2.6s" begin="1.35s" repeatCount="indefinite"/>
            </path>
          </svg>

          {/* Destination chips */}
          <Stack gap={12}>
            {DESTINATIONS.map((d) => (
              <Group key={d.name} gap={12} wrap="nowrap" style={{
                padding: "11px 14px", borderRadius: 11, backdropFilter: "blur(6px)",
                background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.10)",
              }}>
                <Box style={{
                  width: 30, height: 30, borderRadius: 8, flex: "none",
                  display: "grid", placeItems: "center", color: "#fff",
                  fontWeight: 800, fontSize: 13, background: d.bg,
                }}>{d.glyph}</Box>
                <Box style={{flex: 1, minWidth: 0}}>
                  <Text fz={13.5} fw={700} c="#eef4fb" lh={1.2}>{d.name}</Text>
                  <Text fz={11} c="#8aa0b8" style={{fontFamily: MONO}}>{d.sub}</Text>
                </Box>
                <Group gap={6} wrap="nowrap">
                  <span style={{width: 6, height: 6, borderRadius: "50%", background: "#a7d840", display: "block"}}/>
                  <Text fz={11} fw={600} c="#a7d840">Live</Text>
                </Group>
              </Group>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* Stat strip */}
      <Group gap={36} wrap="nowrap" style={{
        position: "relative", zIndex: 2, paddingTop: 24,
        borderTop: "1px solid rgba(255,255,255,.10)",
      }}>
        {[["99.98%", "Delivery uptime"], ["<2s", "Restream latency"], ["20+", "Destinations"]].map(([v, l]) => (
          <Box key={l}>
            <Text fz={22} fw={800} c="#fff" style={{letterSpacing: "-0.02em"}}>{v}</Text>
            <Text fz={12.5} c="#92a6bd">{l}</Text>
          </Box>
        ))}
      </Group>
    </Box>
  );
}
