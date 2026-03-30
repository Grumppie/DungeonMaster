import { expect, test } from "@playwright/test";

import { ensureAuthStateDir, guestAuthStatePath } from "../fixtures/authStates.mjs";
import { testIds, waitForSignedInRoomEntry } from "../fixtures/pages.mjs";
import { getRoleCredentials, signInWithClerkCredentials } from "../utils/clerkAuth.mjs";

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

  const credentials = getRoleCredentials("guest");
  if (credentials.username && credentials.password) {
    await signInWithClerkCredentials(page, credentials);
  } else {
    await waitForSignedInRoomEntry(page);
  }

  await page.context().storageState({ path: guestAuthStatePath });
});
