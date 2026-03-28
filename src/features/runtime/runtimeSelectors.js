export function selectActiveScene(sceneRuntime, adventure) {
  return sceneRuntime?.activeScene || adventure?.scenes?.find((scene) => scene.status === "active") || null;
}

export function selectPartyHistory(adventure) {
  return (adventure?.scenes || []).filter((scene) => scene.status === "completed");
}

export function selectSceneFacts(sceneRuntime) {
  return (sceneRuntime?.sceneFacts || []).slice(-5).reverse();
}
