//
// Copyright (c) 2022-2024 Winlin
//
// SPDX-License-Identifier: MIT
//
// Minimal ESLint config focused on catching undefined identifiers (e.g. a design
// token used but not imported) — the class of bug the bundler does NOT flag and
// that only surfaces at runtime. Runs in CI via the `test` npm script.
import globals from "globals";

const testGlobals = {
  describe: "readonly", it: "readonly", test: "readonly", expect: "readonly",
  vi: "readonly", jest: "readonly", vitest: "readonly",
  beforeEach: "readonly", afterEach: "readonly", beforeAll: "readonly", afterAll: "readonly",
  global: "readonly",
};

export default [
  {
    files: ["src/**/*.{js,jsx}"],
    linterOptions: {
      // Stale CRA-era eslint-disable comments remain in a couple of test files;
      // don't fail on them.
      reportUnusedDisableDirectives: "off",
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {ecmaFeatures: {jsx: true}},
      globals: {
        ...globals.browser,
        ...testGlobals,
        React: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
    },
  },
];
