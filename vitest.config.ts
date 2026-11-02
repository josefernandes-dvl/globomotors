import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const pastaServer = fileURLToPath(new URL("./server", import.meta.url));

const isolamento = {
  restoreMocks: true,
  unstubEnvs: true,
  unstubGlobals: true,
};

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["shared/src/**", "server/src/**", "web/src/**"],
      exclude: ["**/*.test.{ts,tsx}", "**/testes/**", "server/src/index.ts", "web/src/main.tsx"],
    },
    projects: [
      {
        extends: "./web/vite.config.ts",
        test: {
          ...isolamento,
          name: "web",
          root: "./web",
          environment: "jsdom",
          setupFiles: ["./src/testes/setup.ts"],
          testTimeout: 15_000,
        },
      },
      {
        test: {
          ...isolamento,
          name: "server",
          root: "./server",
          environment: "node",
          env: loadEnv("test", pastaServer, ""),
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
      {
        test: {
          ...isolamento,
          name: "shared",
          root: "./shared",
          environment: "node",
        },
      },
    ],
  },
});
