import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Non-app tooling/content — not part of the Next.js app
      ".claude/**",
      "plans/**",
      "docs/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      "@next/next/no-img-element": "off",
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      /*
       * Off deliberately, not overlooked. This rule fires on any static element
       * carrying a handler, which includes the wrappers whose only job is
       * stopPropagation — those are not controls and giving them a role or a
       * tabIndex would create focus stops that do nothing. The failure it
       * exists to catch, a div impersonating a button, is already an error
       * under click-events-have-key-events and interactive-supports-focus.
       */
      "jsx-a11y/no-static-element-interactions": "off",
      "jsx-a11y/interactive-supports-focus": "error",
      // Catches unlabelled form controls. Verified NOT to catch an icon-only
      // <button> whose child is aria-hidden, even at depth 4 — that class of
      // gap stays a human check, see CLAUDE.md.
      "jsx-a11y/control-has-associated-label": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/role-has-required-aria-props": "error"
    }
  }
];

export default eslintConfig;
