import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const baseDirectory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory,
  recommendedConfig: js.configs.recommended,
});

const sourceFiles = ["src/**/*.{ts,tsx}"];

export default [
  {
    ignores: [".vite/**", "dist/**", "node_modules/**", "out/**", "tmp/**"],
  },
  ...compat
    .extends("./.eslintrc.json")
    .map((config) => ({ ...config, files: sourceFiles })),
  {
    files: sourceFiles,
    // Existing source has rule debt from before the ESLint 9 migration. Keep
    // reporting it while allowing `yarn lint` to serve as a usable check.
    rules: {
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-namespace": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "import/export": "warn",
      "import/no-unresolved": "warn",
      "no-case-declarations": "warn",
      "no-control-regex": "warn",
      "no-empty": "warn",
      "no-extra-boolean-cast": "warn",
      "no-fallthrough": "warn",
      // TypeScript already validates value/type namespaces. Core no-undef
      // misidentifies the project's global `.d.ts` aliases as values.
      "no-undef": "off",
      "no-useless-escape": "warn",
      "prefer-const": "warn",
    },
  },
];
