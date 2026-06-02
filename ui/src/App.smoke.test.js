//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
import {test, expect} from 'vitest';

// Importing App pulls in the whole page/component tree at module-eval time.
// This catches stray CommonJS (e.g. `require('uuid')`) that builds fine but
// throws "require is not defined" in the browser/ESM runtime.
test('App module tree loads without stray CommonJS require', async () => {
  const mod = await import('./App');
  expect(typeof mod.default).toBe('function');
});
