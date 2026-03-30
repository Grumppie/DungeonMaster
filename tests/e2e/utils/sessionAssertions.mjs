import { expect } from "@playwright/test";

import { participantCard, testIds } from "../fixtures/pages.mjs";

export async function expectNoVisibleAppError(page) {
  await expect(page.getByTestId(testIds.appErrorBanner)).toHaveCount(0);
}

export async function expectParticipantReady(page, visibleName) {
  await expect(participantCard(page, visibleName)).toContainText("Ready");
}

export async function readLobbyJoinCode(page) {
  const rawText = (await page.getByTestId(testIds.sessionJoinCode).textContent()) || "";
  const match = rawText.match(/Code\s+([A-Z0-9]+)/i);
  if (!match) {
    throw new Error(`Unable to parse lobby join code from "${rawText}".`);
  }
  return match[1].toUpperCase();
}
