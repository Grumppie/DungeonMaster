export async function runTransitionGraph({ sceneProgress, anchor }) {
  if (!anchor) {
    return {
      allowed: false,
      blockerReason: "There is no valid transition at this tile.",
    };
  }

  if (!sceneProgress?.transitionUnlocked) {
    return {
      allowed: false,
      blockerReason: anchor.blockerReason || "The scene exit is still locked.",
    };
  }

  return {
    allowed: true,
    blockerReason: null,
  };
}
