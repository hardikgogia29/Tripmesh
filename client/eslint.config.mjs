import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // Generated Prisma client output - not our code, not committed, should
    // never be linted (a fresh `pnpm install` regenerates it and a fresh
    // `pnpm build` used to fail on it).
    ignores: ["lib/generated/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
