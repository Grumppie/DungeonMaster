import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";

export default defineConfig({
  testDir: "./tests/e2e/specs",
  globalSetup: "./tests/e2e/global.setup.mjs",
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "bootstrap-host",
      grep: /bootstrap host auth state/i,
      use: {
        ...devices["Desktop Chrome"],
        baseURL,
      },
    },
    {
      name: "bootstrap-guest",
      grep: /bootstrap guest auth state/i,
      use: {
        ...devices["Desktop Chrome"],
        baseURL,
      },
    },
    {
      name: "e2e",
      grep: /host creates room, guest joins, both ready, host starts run/i,
      use: {
        ...devices["Desktop Chrome"],
        baseURL,
      },
    },
  ],
});
