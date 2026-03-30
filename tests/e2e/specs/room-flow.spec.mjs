import { expect, test } from "@playwright/test";

import {
  guestAuthStatePath,
  hostAuthStatePath,
  requireAuthState,
} from "../fixtures/authStates.mjs";
import {
  archetypeButton,
  testIds,
  waitForSignedInRoomEntry,
} from "../fixtures/pages.mjs";
import {
  expectNoVisibleAppError,
  expectParticipantReady,
  readLobbyJoinCode,
} from "../utils/sessionAssertions.mjs";
import {
  waitForLobby,
  waitForParticipant,
  waitForRuntime,
} from "../utils/waiters.mjs";

test("host creates room, guest joins, both ready, host starts run", async ({ browser, baseURL }) => {
  const hostContext = await browser.newContext({
    storageState: requireAuthState(hostAuthStatePath, "host"),
  });
  const guestContext = await browser.newContext({
    storageState: requireAuthState(guestAuthStatePath, "guest"),
  });

  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();
  const hostName = "Host Harbor";
  const guestName = "Guest Gale";

  try {
    await hostPage.goto(baseURL || "/");
    await waitForSignedInRoomEntry(hostPage);
    await expectNoVisibleAppError(hostPage);

    await hostPage.getByTestId(testIds.createCharacterNameInput).fill(hostName);
    await hostPage.getByTestId(testIds.sessionTitleInput).fill("The Playwright Cartographer");
    await hostPage.getByTestId(testIds.createRoomButton).click();

    await waitForLobby(hostPage);
    await waitForParticipant(hostPage, hostName);
    await expect(hostPage.getByTestId(testIds.startRunButton)).toBeDisabled();

    const joinCode = await readLobbyJoinCode(hostPage);

    await guestPage.goto(baseURL || "/");
    await waitForSignedInRoomEntry(guestPage);
    await expectNoVisibleAppError(guestPage);
    await guestPage.getByTestId(testIds.joinCharacterNameInput).fill(guestName);
    await guestPage.getByTestId(testIds.joinCodeInput).fill(joinCode);
    await guestPage.getByTestId(testIds.joinRoomButton).click();

    await waitForLobby(guestPage);
    await waitForParticipant(guestPage, hostName);
    await waitForParticipant(guestPage, guestName);
    await waitForParticipant(hostPage, guestName);

    await archetypeButton(hostPage, "human-fighter").click();
    await archetypeButton(guestPage, "dwarf-cleric").click();

    await expectParticipantReady(hostPage, hostName);
    await expectParticipantReady(hostPage, guestName);
    await expectParticipantReady(guestPage, hostName);
    await expectParticipantReady(guestPage, guestName);
    await expect(hostPage.getByTestId(testIds.startRunButton)).toBeEnabled();

    await hostPage.getByTestId(testIds.startRunButton).click();

    await waitForRuntime(hostPage);
    await waitForRuntime(guestPage);
    await expectNoVisibleAppError(hostPage);
    await expectNoVisibleAppError(guestPage);
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()]);
  }
});
