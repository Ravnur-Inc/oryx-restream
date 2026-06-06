//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
// Design-system shell mockup (Mantine) for sign-off BEFORE the full rewrite.
// Shows the target AppShell: responsive sidebar + top bar + dark/light toggle,
// plus a sample page exercising the new component look in both color schemes.
// Self-contained MantineProvider so it doesn't disturb the current app.
import React from "react";
import {
  MantineProvider, AppShell, Burger, Group, Title, Text, NavLink, ActionIcon,
  Card, SimpleGrid, Badge, Button, Switch, TextInput, Select, Tooltip, Stack,
  Box, Divider, Avatar, Menu, useMantineColorScheme, useComputedColorScheme,
  rem,
} from "@mantine/core";
import {useDisclosure} from "@mantine/hooks";
import {
  IconBroadcast, IconDeviceTv, IconServer2, IconUsers, IconLogout,
  IconSun, IconMoon, IconCircleFilled, IconActivity, IconChevronDown,
} from "@tabler/icons-react";
import {ravnurTheme} from "../theme";
import logo from "../resources/ravnur-logo.svg";

const NAV = [
  {key: "overview", label: "Overview", icon: IconActivity},
  {key: "ingest", label: "Ingest", icon: IconBroadcast},
  {key: "channels", label: "Channels", icon: IconDeviceTv},
  {key: "destinations", label: "Destinations", icon: IconServer2},
  {key: "users", label: "Users", icon: IconUsers},
];

// Health badge in the new design language (maps our levels to Mantine colors).
function Health({level, label}) {
  const map = {
    healthy: {color: "teal", icon: "●"},
    warning: {color: "yellow", icon: "▲"},
    down: {color: "red", icon: "■"},
    blocked: {color: "orange", icon: "⊘"},
    idle: {color: "gray", icon: "○"},
  };
  const m = map[level] || map.idle;
  return <Badge color={m.color} variant="light" radius="sm">{m.icon} {label}</Badge>;
}

function ColorToggle() {
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

function Shell() {
  const [opened, {toggle}] = useDisclosure();
  const [section, setSection] = React.useState("overview");
  const computed = useComputedColorScheme("light", {getInitialValueInEffect: true});
  const dark = computed === "dark";

  return (
    <AppShell
      header={{height: 60}}
      navbar={{width: 280, breakpoint: "sm", collapsed: {mobile: !opened}}}
      padding="lg">
      {/* Top bar */}
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm"/>
            <Box
              px={8} py={4}
              style={{
                background: dark ? "rgba(255,255,255,0.92)" : "transparent",
                borderRadius: 8, display: "flex", alignItems: "center",
              }}>
              <img src={logo} alt="Ravnur" style={{height: 22, display: "block"}}/>
            </Box>
            <Text fw={800} size="sm" visibleFrom="xs">Simulcast Manager</Text>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <ColorToggle/>
            <Menu position="bottom-end" withArrow>
              <Menu.Target>
                <Button variant="subtle" color="gray" rightSection={<IconChevronDown size={14}/>}
                  leftSection={<Avatar size={24} radius="xl" color="blue">BH</Avatar>}>
                  <Text size="sm" visibleFrom="xs">owner</Text>
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconLogout size={14}/>} color="red">Sign out</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      {/* Sidebar */}
      <AppShell.Navbar p="sm">
        <Text size="xs" c="dimmed" fw={700} px="sm" py={6} style={{letterSpacing: "0.1em"}}>MENU</Text>
        <Stack gap={2}>
          {NAV.map(item => (
            <NavLink
              key={item.key}
              active={section === item.key}
              label={item.label}
              leftSection={<item.icon size={18} stroke={1.7}/>}
              onClick={() => { setSection(item.key); }}
              variant="filled"
            />
          ))}
        </Stack>
        <Box style={{marginTop: "auto"}}>
          <Divider my="sm"/>
          <Group justify="space-between" px="sm" pb="xs">
            <Text size="xs" c="dimmed">Theme</Text>
            <ColorToggle/>
          </Group>
        </Box>
      </AppShell.Navbar>

      {/* Content */}
      <AppShell.Main>
        {section === "channels" ? <ChannelsSample/> : section === "ingest" ? <IngestSample/> : <OverviewSample/>}
      </AppShell.Main>
    </AppShell>
  );
}

function OverviewSample() {
  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Overview</Title>
        <Text c="dimmed" size="sm">A preview of the new design language — try the light/dark toggle (top-right).</Text>
      </div>

      <SimpleGrid cols={{base: 1, xs: 2, md: 4}} spacing="lg">
        {[
          {k: "Channels", v: "6", c: "blue"},
          {k: "Live now", v: "3", c: "teal"},
          {k: "Outputs", v: "11", c: "blue"},
          {k: "Need attention", v: "1", c: "yellow"},
        ].map(s => (
          <Card key={s.k} withBorder radius="md" padding="lg">
            <Text size="xs" c="dimmed" fw={700} style={{letterSpacing: "0.08em"}}>{s.k.toUpperCase()}</Text>
            <Text fw={800} size={rem(30)} c={s.c}>{s.v}</Text>
          </Card>
        ))}
      </SimpleGrid>

      <Card withBorder radius="md" padding="lg">
        <Title order={4} mb="md">Components</Title>
        <Stack gap="md">
          <Group gap="xs">
            <Health level="healthy" label="HEALTHY"/>
            <Health level="warning" label="DEGRADED"/>
            <Health level="down" label="DOWN"/>
            <Health level="blocked" label="BLOCKED"/>
            <Health level="idle" label="IDLE"/>
          </Group>
          <Group gap="sm">
            <Button>Primary</Button>
            <Button variant="light">Light</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="subtle" color="gray">Subtle</Button>
            <Button color="red" variant="light">Danger</Button>
          </Group>
          <Group gap="lg" align="flex-end">
            <TextInput label="Stream name" placeholder="sunday-service" w={220}/>
            <Select label="Key length" defaultValue="16" w={160}
              data={[{value: "16", label: "AES-128"}, {value: "24", label: "AES-192"}, {value: "32", label: "AES-256"}]}/>
            <Switch label="SRT encryption" defaultChecked/>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}

function ChannelsSample() {
  const rows = [
    {name: "Sunday Service", stream: "sunday-service", src: "healthy", outs: [["YouTube", "healthy"], ["Facebook", "warning"]]},
    {name: "Council Meeting", stream: "council", src: "idle", outs: [["City YouTube", "blocked"]]},
    {name: "Field Camera", stream: "field-1", src: "healthy", outs: [["Backup RTMP", "healthy"], ["Twitch", "down"]]},
  ];
  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div><Title order={2}>Channels</Title><Text c="dimmed" size="sm">Routes and their destinations.</Text></div>
        <Button>+ Add Channel</Button>
      </Group>
      <Stack gap="md">
        {rows.map(r => (
          <Card key={r.stream} withBorder radius="md" padding="lg">
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <IconCircleFilled size={12} color={r.src === "healthy" ? "var(--mantine-color-teal-6)" : "var(--mantine-color-gray-5)"}/>
                <div>
                  <Text fw={700}>{r.name}</Text>
                  <Text size="xs" c="dimmed">stream: {r.stream}</Text>
                </div>
              </Group>
              <Group gap="xs">
                <Health level={r.src} label={r.src === "healthy" ? "HEALTHY" : "IDLE"}/>
                <Button size="xs" variant="light">Monitor</Button>
                <Button size="xs" variant="default">Manage</Button>
              </Group>
            </Group>
            <Divider my="sm"/>
            <Group gap="xs">
              {r.outs.map(([label, lvl]) => (
                <Badge key={label} variant="outline" color="gray" radius="sm" leftSection={<Health level={lvl} label=""/>}>{label}</Badge>
              ))}
            </Group>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function IngestSample() {
  return (
    <Stack gap="lg" maw={620}>
      <div><Title order={2}>Ingest</Title><Text c="dimmed" size="sm">Publish key and encoder settings.</Text></div>
      <Card withBorder radius="md" padding="lg">
        <Title order={5} mb="sm">SRT encryption</Title>
        <Group justify="space-between">
          <Text size="sm">Require an AES passphrase on SRT ingest.</Text>
          <Switch size="md" defaultChecked/>
        </Group>
        <TextInput mt="md" label="Passphrase" defaultValue="k9Lm2Qp7xZ…" readOnly
          rightSection={<Button size="compact-xs" variant="subtle">Copy</Button>} rightSectionWidth={56}/>
        <Text size="xs" c="yellow" mt="xs">⚠ Saving restarts the server (~10–20s); all streams reconnect.</Text>
      </Card>
    </Stack>
  );
}

export default function DesignPreview() {
  return (
    <MantineProvider theme={ravnurTheme} defaultColorScheme="auto">
      <Shell/>
    </MantineProvider>
  );
}
