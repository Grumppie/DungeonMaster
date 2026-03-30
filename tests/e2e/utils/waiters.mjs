import { expect } from "@playwright/test";

import { participantCard, testIds } from "../fixtures/pages.mjs";

export async function waitForLobby(page) {
  await expect(page.getByTestId(testIds.inviteLinkInput)).toBeVisible();
  await expect(page.getByTestId(testIds.sessionJoinCode)).toBeVisible();
}

export async function waitForParticipant(page, visibleName) {
  await expect(participantCard(page, visibleName)).toBeVisible();
}

export async function waitForRuntime(page) {
  await expect(page.getByTestId(testIds.runtimeShellRoot)).toBeVisible({ timeout: 60000 });
}
