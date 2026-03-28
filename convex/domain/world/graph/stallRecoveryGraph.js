export async function runStallRecoveryGraph({ scene, stallCounter = 0 }) {
  const plan = scene.stallRecoveryPlan || { mode: "escalating_nudge", triggerAfterInteractions: 3 };
  if (stallCounter < plan.triggerAfterInteractions) {
    return null;
  }

  const cues = [
    "A distant noise draws attention toward the live route.",
    "The environment shifts just enough to reveal what matters next.",
    "Someone nearby reacts, making the pressure in the scene harder to ignore.",
  ];

  return {
    mode: plan.mode,
    summary: cues[Math.min(cues.length - 1, stallCounter - plan.triggerAfterInteractions)],
    pressureDelta: stallCounter >= plan.triggerAfterInteractions + 1 ? 1 : 0,
  };
}
