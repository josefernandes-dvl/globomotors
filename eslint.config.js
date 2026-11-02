import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const mensagemShared =
  "shared/ roda no navegador e no Node: importe só zod e arquivos do próprio shared/.";

export default defineConfig([
  globalIgnores(["**/dist", "**/coverage", "server/drizzle"]),
  {
    files: ["**/*.{js,ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["web/src/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    files: ["web/src/**/*.{ts,tsx}"],
    ignores: ["web/src/lib/api.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Chame a API só por web/src/lib/api.ts (api.get, api.post...)." },
      ],
    },
  },
  {
    files: ["server/src/rotas/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(drizzle-orm|pg)(/|$)|/db/",
              message: "Rota não acessa o banco: use os repositórios (server/src/repositorios).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["shared/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ regex: "^(?!zod$|\\.{1,2}/)", message: mensagemShared }] },
      ],
    },
  },
  {
    files: ["shared/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ regex: "^(?!(zod|vitest)$|\\.{1,2}/)", message: mensagemShared }] },
      ],
    },
  },
  prettier,
]);
