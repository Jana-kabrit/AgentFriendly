import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import unicornPlugin from "eslint-plugin-unicorn";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/.astro/**",
      "**/.venv/**",
      "examples/**",
      "vitest.config.ts",
      "docs-site/src/env.d.ts",
      "docs-site/.astro/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
      unicorn: unicornPlugin,
    },
    rules: {
      // TypeScript rules
      ...tsPlugin.configs["recommended"].rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/explicit-function-return-type": ["error", {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],

      // Import rules
      "import/order": ["error", {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
        "newlines-between": "always",
        alphabetize: { order: "asc" },
      }],
      "import/no-duplicates": "error",

      // Unicorn rules (selective — not the full preset which is too opinionated)
      "unicorn/prefer-node-protocol": "error",
      "unicorn/no-array-for-each": "error",
      "unicorn/prefer-array-flat-map": "error",
      "unicorn/prefer-string-trim-start-end": "error",
      "unicorn/throw-new-error": "error",

      // General rules
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: [
      "packages/cli/**/*.ts",
      "packages/ua-database/src/validate.ts",
    ],
    rules: {
      "no-console": "off",
    },
  },
];
