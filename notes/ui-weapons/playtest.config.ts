// Browser playtest against an independently managed preview server.
import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: fileURLToPath(new URL("../../e2e/", import.meta.url)),
  testMatch: "weapons.spec.ts",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4185/",
    viewport: { width: 1600, height: 950 },
  },
});
