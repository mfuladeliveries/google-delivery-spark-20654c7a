import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load E2E credentials from .env.e2e (gitignored)
dotenv.config({ path: path.resolve(__dirname, ".env.e2e") });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // tests share state via the live DB; serialize to avoid order-cancel races
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // The app reads geolocation in the checkout dialog. Pre-grant + mock to a known
    // in-service-area coordinate so create_verified_order's check_service_area passes.
    permissions: ["geolocation"],
    geolocation: { latitude: -26.2041, longitude: 28.0473 }, // Johannesburg CBD
    locale: "en-ZA",
    timezoneId: "Africa/Johannesburg",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "customer",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/customer.json" },
      dependencies: ["setup"],
      testMatch: /customer-.*\.spec\.ts/,
    },
    {
      name: "driver",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/driver.json" },
      dependencies: ["setup"],
      testMatch: /driver-.*\.spec\.ts/,
    },
    {
      name: "restaurant",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/restaurant.json" },
      dependencies: ["setup"],
      testMatch: /restaurant-.*\.spec\.ts/,
    },
    {
      name: "admin",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/admin.json" },
      dependencies: ["setup"],
      testMatch: /admin-.*\.spec\.ts/,
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "bun run dev",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
