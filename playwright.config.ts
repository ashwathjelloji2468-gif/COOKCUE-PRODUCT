import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: "npm run start -- -p 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: {
      PORT: "3001",
      APP_BASE_URL: "http://127.0.0.1:3001",
      DISABLE_REAL_EMAIL: "true",
      DATABASE_URL: process.env.DATABASE_URL || "",
      SESSION_SECRET: process.env.SESSION_SECRET || "ci_test_environment_session_secret_at_least_32_characters_long",
    },
  },
});
