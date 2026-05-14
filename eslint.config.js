import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Deno edge functions run in a different runtime and use loose typing for SDK interop;
    // they are linted separately via deno fmt/lint, not the app ESLint config.
    ignores: [
      "dist",
      "build",
      "node_modules",
      "playwright-report",
      "test-results",
      "supabase/functions/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Demote to warn — we have a large existing surface using `any` for third-party
      // SDK shapes. CI enforces 0 errors but allows the existing warning baseline.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
