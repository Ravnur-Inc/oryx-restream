//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
// Shared design tokens, mapped to Mantine CSS variables so they adapt to the
// active color scheme (light/dark) automatically. This replaces the burnt-orange
// hex tokens that were copy-pasted into every page; importing these makes the
// existing inline-styled markup theme-aware without rewriting each style.
export const ACCENT        = "var(--mantine-primary-color-filled)";        // brand text/icon
export const ACCENT_HOVER  = "var(--mantine-primary-color-filled-hover)";
export const ACCENT_SOFT   = "var(--mantine-primary-color-light)";          // subtle brand surface
export const ACCENT_ON_SOFT= "var(--mantine-primary-color-light-color)";    // text on ACCENT_SOFT
export const BG            = "var(--app-bg)";                               // page background
export const CARD          = "var(--app-surface)";                          // card surface (+ border)
export const PANEL         = "var(--app-panel)";                            // subtle inset surface
export const BORDER        = "var(--mantine-color-default-border)";
export const HEADING       = "var(--mantine-color-text)";
export const BODY          = "var(--mantine-color-text)";
export const SECOND        = "var(--mantine-color-text)";
export const MUTED         = "var(--mantine-color-dimmed)";
export const DANGER        = "var(--mantine-color-red-6)";
export const DANGER_SOFT   = "var(--mantine-color-red-light)";

export const mono = {fontFamily: "'Public Sans', sans-serif", fontVariantNumeric: "tabular-nums"};
export const syne = {fontFamily: "'Public Sans', sans-serif"};
