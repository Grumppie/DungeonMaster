import { expect, test } from "@playwright/test";

import { ensureAuthStateDir, hostAuthStatePath } from "../fixtures/authStates.mjs";
import { testIds, waitForSignedInRoomEntry } from "../fixtures/pages.mjs";
import { getRoleCredentials, signInWithClerkCredentials } from "../utils/clerkAuth.mjs";

test("bootstrap host auth state", async ({ page }) => {
  ensureAuthStateDir();

  await page.goto("/");

  const createRoomButton = page.getByTestId(testIds.createRoomButton);
  const signInButton = page.getByRole("button", { name: /sign in/i });

  if (await createRoomButton.isVisible().catch(() => false)) {
    await page.context().storageState({ path: hostAuthStatePath });
    return;
  }

  await expect(signInButton).toBeVisible();
  await signInButton.click();

  const credentials = getRoleCredentials("host");
  if (credentials.username && credentials.password) {
    await signInWithClerkCredentials(page, credentials);
  } else {
    await waitForSignedInRoomEntry(page);
  }

  await page.context().storageState({ path: hostAuthStatePath });
});
