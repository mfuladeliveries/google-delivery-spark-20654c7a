import { test as setup, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_DIR = path.join(__dirname, ".auth");

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
}

interface RoleCreds {
  label: string;
  email: string | undefined;
  password: string | undefined;
  storage: string;
  // Path we expect the app to redirect to after login (used to confirm auth worked).
  // We accept any path under this prefix.
  expectedPathPrefix: string;
  loginUrl: string;
}

const roles: RoleCreds[] = [
  {
    label: "customer",
    email: process.env.E2E_CUSTOMER_EMAIL,
    password: process.env.E2E_CUSTOMER_PASSWORD,
    storage: path.join(AUTH_DIR, "customer.json"),
    expectedPathPrefix: "/",
    loginUrl: "/auth",
  },
  {
    label: "driver",
    email: process.env.E2E_DRIVER_EMAIL,
    password: process.env.E2E_DRIVER_PASSWORD,
    storage: path.join(AUTH_DIR, "driver.json"),
    expectedPathPrefix: "/driver",
    loginUrl: "/auth",
  },
  {
    label: "restaurant",
    email: process.env.E2E_RESTAURANT_EMAIL,
    password: process.env.E2E_RESTAURANT_PASSWORD,
    storage: path.join(AUTH_DIR, "restaurant.json"),
    expectedPathPrefix: "/restaurant",
    loginUrl: "/auth",
  },
  {
    label: "admin",
    email: process.env.E2E_ADMIN_EMAIL,
    password: process.env.E2E_ADMIN_PASSWORD,
    storage: path.join(AUTH_DIR, "admin.json"),
    expectedPathPrefix: "/admin",
    loginUrl: "/auth",
  },
];

for (const role of roles) {
  setup(`authenticate as ${role.label}`, async ({ page }) => {
    if (!role.email || !role.password) {
      setup.skip(true, `Missing E2E_${role.label.toUpperCase()}_EMAIL/PASSWORD in .env.e2e`);
    }

    ensureAuthDir();

    await page.goto(role.loginUrl);
    await page.getByPlaceholder("you@example.com").fill(role.email!);
    await page.getByPlaceholder("••••••••").fill(role.password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    // Wait until the app redirects away from /auth — that's our success signal.
    // The exact landing path depends on multi-role priority, so we just assert
    // we left /auth and that the URL starts with the expected prefix.
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 20_000 });

    // Sanity: prefix match (admin lands on /admin, driver on /driver, etc.)
    // Customers can land on "/" so the "/" prefix matches everything — that's fine.
    const finalPath = new URL(page.url()).pathname;
    expect(finalPath.startsWith(role.expectedPathPrefix)).toBe(true);

    await page.context().storageState({ path: role.storage });
  });
}
