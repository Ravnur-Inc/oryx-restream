//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
// Ravnur Mantine theme. Single source of truth for brand color, typography,
// radius and density — replaces the per-page inline design tokens. Works in both
// light and dark color schemes (Mantine derives dark surfaces automatically;
// the brand primary shade is tuned per scheme for contrast).
import {createTheme} from "@mantine/core";

// Burnt-orange brand ramp (light → dark). Index 7 is the canonical Ravnur
// #b54100; lighter shades read better on dark backgrounds.
const ravnur = [
  "#fff4ec",
  "#ffe3d2",
  "#ffc4a3",
  "#ff9f6b",
  "#fa7d3c",
  "#e9651f",
  "#d2570f",
  "#b54100",
  "#8f3400",
  "#6b2700",
];

export const ravnurTheme = createTheme({
  primaryColor: "ravnur",
  // Brand on light surfaces; a touch lighter on dark for AA contrast.
  primaryShade: {light: 7, dark: 5},
  colors: {ravnur},
  fontFamily: "'Public Sans', system-ui, sans-serif",
  fontFamilyMonospace: "'Public Sans', ui-monospace, monospace",
  headings: {fontFamily: "'Public Sans', system-ui, sans-serif", fontWeight: "800"},
  defaultRadius: "md",
  // Comfortable density.
  spacing: {xs: "0.625rem", sm: "0.875rem", md: "1.125rem", lg: "1.5rem", xl: "2rem"},
});
