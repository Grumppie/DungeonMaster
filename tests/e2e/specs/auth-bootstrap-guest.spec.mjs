import { expect, test } from "@playwright/test";

import { ensureAuthStateDir, guestAuthStatePath } from "../fixtures/authStates.mjs";
import { testIds, waitForSignedInRoomEntry } from "../fixtures/pages.mjs";

test("bootstrap guest auth state", async ({ page }) => {
  ensureAuthStateDir();

  await page.goto("/");

  const createRoomButton = page.getByTestId(testIds.createRoomButton);
  const signInButton = page.getByRole("button", { name: /sign in/i });

  if (await createRoomButton.isVisible().catch(() => false)) {
    await page.context().storageState({ path: guestAuthStatePath });
    return;
  }

  await expect(signInButton).toBeVisible();
  await signInButton.click();
  await waitForSignedInRoomEntry(page);
  await page.context().storageState({ path: guestAuthStatePath });
});
