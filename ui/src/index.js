//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
import React from 'react';
import {createRoot} from 'react-dom/client';
// Mantine styles (design-system migration). Imported before app styles so our
// own overrides win.
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';
import './i18n';
import App from './App';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
