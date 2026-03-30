import { expect } from "@playwright/test";

import { waitForSignedInRoomEntry } from "../fixtures/pages.mjs";

function readCredential(...values) {
  for (const value of values) {
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

export function getRoleCredentials(role) {
  const normalizedRole = String(role || "").trim().toUpperCase();
  return {
    username: readCredential(
      process.env[`PLAYWRIGHT_E2E_${normalizedRole}_USERNAME`],
      process.env.PLAYWRIGHT_E2E_USERNAME,
    ),
    password: readCredential(
      process.env[`PLAYWRIGHT_E2E_${normalizedRole}_PASSWORD`],
      process.env.PLAYWRIGHT_E2E_PASSWORD,
    ),
  };
}

export async function signInWithClerkCredentials(page, credentials) {
  await expect(page.locator('input[name="identifier"]')).toBeVisible({ timeout: 30000 });
  await page.locator('input[name="identifier"]').fill(credentials.username);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.getByRole("button", { name: /^continue$/i }).click();
  await waitForSignedInRoomEntry(page, { timeout: 120000 });
}
