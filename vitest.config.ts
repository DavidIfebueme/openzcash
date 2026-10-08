import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Unit tests stay keyword-only and hermetic; evaluation.test.ts builds its own retriever around the real model when its files are present.
    env: { ZARVIS_SEMANTIC: "false" },
  },
});
