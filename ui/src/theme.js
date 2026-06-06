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

export const ravnurTheme = createTheme({
  // Brand/accent color family. Mantine ships this ramp built-in.
  primaryColor: "blue",
  // Canonical shade on light surfaces; a touch lighter on dark for AA contrast.
  primaryShade: {light: 6, dark: 4},
  fontFamily: "'Public Sans', system-ui, sans-serif",
  fontFamilyMonospace: "'Public Sans', ui-monospace, monospace",
  headings: {fontFamily: "'Public Sans', system-ui, sans-serif", fontWeight: "800"},
  defaultRadius: "md",
  // Comfortable density.
  spacing: {xs: "0.625rem", sm: "0.875rem", md: "1.125rem", lg: "1.5rem", xl: "2rem"},
});
