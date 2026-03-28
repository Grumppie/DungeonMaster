export async function runScenarioUpdateGraph({ scene, trigger }) {
  const allowed = scene.allowedMicroScenarios || [];
  const matched =
    allowed.find((entry) => trigger && String(entry).toLowerCase().includes(String(trigger).toLowerCase())) ||
    allowed[0] ||
    null;

  if (!matched) {
    return null;
  }

  return {
    scenarioKey: matched,
    summary: `The scene shifts through ${matched.replace(/_/g, " ")}.`,
  };
}
