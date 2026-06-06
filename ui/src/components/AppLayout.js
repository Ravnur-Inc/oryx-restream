//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
// The shared application shell: a responsive Mantine AppShell with a sidebar,
// top bar, and dark/light toggle. Rendered as a react-router layout route so
// every authed page lives inside it (replaces the per-page NavBars).
import React from "react";
import {
  AppShell, Burger, Group, Text, NavLink, ActionIcon, Tooltip, Box, Divider,
  Menu, Button, Avatar, useMantineColorScheme, useComputedColorScheme,
} from "@mantine/core";
import {useDisclosure} from "@mantine/hooks";
import {Outlet, useLocation, useNavigate} from "react-router-dom";
import {
  IconBroadcast, IconDeviceTv, IconServer2, IconUsers, IconLogout,
  IconSun, IconMoon, IconChevronDown, IconActivity,
} from "@tabler/icons-react";
import {Token, Locale} from "../utils";
import logo from "../resources/ravnur-logo.svg";

const NAV = [
  {to: "/routers-ingest", label: "Ingest", icon: IconBroadcast},
  {to: "/routers-channels", label: "Channels", icon: IconDeviceTv},
  {to: "/routers-destinations", label: "Destinations", icon: IconServer2},
  {to: "/routers-users", label: "Users", icon: IconUsers, ownerOnly: true},
  {to: "/routers-system", label: "System", icon: IconActivity, ownerOnly: true},
];

export function ColorToggle() {
  const {setColorScheme} = useMantineColorScheme();
  const computed = useComputedColorScheme("light", {getInitialValueInEffect: true});
  const dark = computed === "dark";
  return (
    <Tooltip label={dark ? "Switch to light" : "Switch to dark"}>
      <ActionIcon variant="default" size="lg" aria-label="Toggle color scheme"
        onClick={() => setColorScheme(dark ? "light" : "dark")}>
        {dark ? <IconSun size={18}/> : <IconMoon size={18}/>}
      </ActionIcon>
    </Tooltip>
  );
}

export default function AppLayout() {
  const [opened, {toggle, close}] = useDisclosure();
  const location = useLocation();
  const navigate = useNavigate();
  const computed = useComputedColorScheme("light", {getInitialValueInEffect: true});
  const dark = computed === "dark";

  const user = Token.loadUser();
  const isOwner = !user || user.role === "owner";
  const items = NAV.filter(i => !i.ownerOnly || isOwner);

  const isActive = (to) => location.pathname.includes(to)
    || (to === "/routers-channels" && location.pathname.includes("/routers-monitor"));
  const current = items.find(i => isActive(i.to));
  const title = current?.label
    || (location.pathname.includes("/routers-monitor") ? "Monitor" : "Simulcast Manager");

  // Navigate with the locale prefix to avoid the AppLocale redirect bounce.
  const go = (to) => { navigate(`/${Locale.current()}${to}`); close(); };

  const initials = (user?.email?.[0] || (isOwner ? "O" : "E")).toUpperCase();

  return (
    <AppShell
      header={{height: 60}}
      navbar={{width: 264, breakpoint: "sm", collapsed: {mobile: !opened}}}
      padding="lg"
      styles={{main: {background: "var(--app-bg)"}}}>
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm"/>
            <Box px={8} py={4} style={{
              background: dark ? "rgba(255,255,255,0.92)" : "transparent",
              borderRadius: 8, display: "flex", alignItems: "center",
            }}>
              <img src={logo} alt="Ravnur" style={{height: 22, display: "block"}}/>
            </Box>
            <Text fw={800} size="sm" visibleFrom="xs">{title}</Text>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <ColorToggle/>
            <Menu position="bottom-end" withArrow>
              <Menu.Target>
                <Button variant="subtle" color="gray" rightSection={<IconChevronDown size={14}/>}
                  leftSection={<Avatar size={24} radius="xl" color="blue">{initials}</Avatar>}>
                  <Text size="sm" visibleFrom="xs">{user?.role || "owner"}</Text>
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {user?.email && <Menu.Label>{user.email}</Menu.Label>}
                <Menu.Item leftSection={<IconLogout size={14}/>} color="red" onClick={() => go("/routers-logout")}>
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Text size="xs" c="dimmed" fw={700} px="sm" py={6} style={{letterSpacing: "0.1em"}}>MENU</Text>
        <Box style={{flex: 1}}>
          {items.map(i => (
            <NavLink
              key={i.to}
              active={isActive(i.to)}
              label={i.label}
              leftSection={<i.icon size={18} stroke={1.7}/>}
              onClick={() => go(i.to)}
              variant="filled"
              mb={2}
            />
          ))}
        </Box>
        <Box>
          <Divider my="sm"/>
          <Group justify="space-between" px="sm" pb="xs">
            <Text size="xs" c="dimmed">Theme</Text>
            <ColorToggle/>
          </Group>
        </Box>
      </AppShell.Navbar>

      <AppShell.Main><Outlet/></AppShell.Main>
    </AppShell>
  );
}
