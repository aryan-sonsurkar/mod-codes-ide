import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.js",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "npm run start",
    port: 3000,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
