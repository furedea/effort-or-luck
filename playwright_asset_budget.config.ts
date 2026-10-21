import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/asset-budget",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  webServer: {
    // Serves dist/ as the Worker does, with _headers applied; astro preview ignores both.
    command: "pnpm run preview:worker",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: "http://127.0.0.1:4321/effort-or-luck/",
  },
  use: {
    baseURL: "http://127.0.0.1:4321",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium" }],
});
