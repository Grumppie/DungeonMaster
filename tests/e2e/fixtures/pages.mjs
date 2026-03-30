import { expect } from "@playwright/test";

export const testIds = {
  appErrorBanner: "app-error-banner",
  createCharacterNameInput: "create-character-name-input",
  sessionTitleInput: "session-title-input",
  createRoomButton: "create-room-button",
  joinCharacterNameInput: "join-character-name-input",
  joinCodeInput: "join-code-input",
  joinRoomButton: "join-room-button",
  sessionJoinCode: "session-join-code",
  inviteLinkInput: "invite-link-input",
  startRunButton: "start-run-button",
  runtimeShellRoot: "runtime-shell-root",
};

export function normalizeTestIdSegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

export function participantCard(page, visibleName) {
  return page.getByTestId(`participant-card-${normalizeTestIdSegment(visibleName)}`);
}

export function archetypeButton(page, archetypeKey) {
  return page.getByTestId(`pick-archetype-${archetypeKey}`);
}

export async function waitForSignedInRoomEntry(page) {
  await expect(page.getByTestId(testIds.createCharacterNameInput)).toBeVisible();
  await expect(page.getByTestId(testIds.createRoomButton)).toBeVisible();
}
