import { defineConfig, devices } from "@playwright/test";

/**
 * Essential end-to-end tests (§29). Run `npx playwright install` once to fetch
 * browsers, then `npm run test:e2e`. The config boots the dev server in Demo
 * Mode (no API keys required).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/dashboard",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
