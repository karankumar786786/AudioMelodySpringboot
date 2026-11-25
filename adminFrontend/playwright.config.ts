import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * Smoke tests run against the Next.js dev server with every backend call mocked
 * (see e2e/mock-api.ts), so no adminBackend, S3 or ImageKit is needed.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bunx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Points the app at a host that only the route mocks answer.
      NEXT_PUBLIC_API_URL: "http://api.test",
      NEXT_PUBLIC_S3_BASE_URL: "http://s3.test",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
