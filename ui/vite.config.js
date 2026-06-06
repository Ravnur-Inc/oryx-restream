//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
/// <reference types="vitest" />
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Compatibility with the previous Create-React-App env vars, set by the Makefile:
//   PUBLIC_URL=/mgmt REACT_APP_LOCALE=en|zh BUILD_PATH=build/en|build/zh
const publicUrl = process.env.PUBLIC_URL || '';
const locale = process.env.REACT_APP_LOCALE || 'en';
const outDir = process.env.BUILD_PATH || 'build';
const base = publicUrl ? `${publicUrl.replace(/\/$/, '')}/` : '/';

// Replace the CRA-style %PUBLIC_URL% and %REACT_APP_LOCALE% tokens in index.html.
const htmlEnvPlugin = {
  name: 'html-cra-tokens',
  transformIndexHtml(html) {
    return html
      .replace(/%PUBLIC_URL%/g, publicUrl.replace(/\/$/, ''))
      .replace(/%REACT_APP_LOCALE%/g, locale);
  },
};

// The dev proxy, ported from the old src/setupProxy.js. Mirrors all backend
// mounts to the local mgmt server on 2022 by default; set DEV_PROXY_TARGET to a
// remote deployment (e.g. https://restreamer.ravnur.net) to develop against live data.
const target = process.env.DEV_PROXY_TARGET || 'http://127.0.0.1:2022';
const remote = /^https/i.test(target);
const opt = {target, changeOrigin: remote, secure: false, ws: true};
const proxy = {
  '/console': opt,
  '/players': opt,
  '/terraform': opt,
  '/tools': opt,
  '/api': opt,
  '/rtc': opt,
  '/index.html': opt,
  '^/[^/]+/.+\\.(flv|m3u8|ts|aac|mp3)$': opt,
};

export default defineConfig({
  base,
  plugins: [react(), htmlEnvPlugin],
  build: {
    outDir,
    emptyOutDir: true,
  },
  server: {proxy},
  // The source is legacy CRA code with JSX inside .js files; tell esbuild to
  // treat .js as JSX (both for source and for dependency pre-bundling).
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {'.js': 'jsx'},
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: false,
  },
});
