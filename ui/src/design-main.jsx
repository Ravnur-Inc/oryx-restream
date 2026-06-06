//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
// Standalone entry for the design-system shell mockup — renders DesignPreview
// with no backend/auth so it can be reviewed via `npm run dev` → /design.html.
import React from "react";
import {createRoot} from "react-dom/client";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./index.css";
import DesignPreview from "./pages/DesignPreview";

createRoot(document.getElementById("design-root")).render(
  <React.StrictMode>
    <DesignPreview/>
  </React.StrictMode>
);
