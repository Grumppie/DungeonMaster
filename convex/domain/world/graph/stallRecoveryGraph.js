import { buildStallRecoveryHint } from "../interactionHints";

export async function runStallRecoveryGraph({ scene, stallCounter = 0 }) {
  const plan = scene.stallRecoveryPlan || { mode: "escalating_nudge", triggerAfterInteractions: 3 };
  if (stallCounter < plan.triggerAfterInteractions) {
    return null;
  }

  const cues = [
    buildStallRecoveryHint(scene),
    "The environment shifts just enough to imply a better angle without giving the answer away.",
    "Someone nearby reacts, making the pressure in the scene harder to ignore and harder to postpone.",
  ];

  return {
    mode: plan.mode,
    summary: cues[Math.min(cues.length - 1, stallCounter - plan.triggerAfterInteractions)],
    pressureDelta: stallCounter >= plan.triggerAfterInteractions + 1 ? 1 : 0,
    revealInteractableIds: ((scene.interactables || []).filter((entry) => !entry.hidden).slice(0, 1).map((entry) => entry.id)),
    activateTransitionAnchors: false,
  };
}
