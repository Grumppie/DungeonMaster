export async function runScenarioUpdateGraph({ scene, trigger }) {
  const allowed = scene.allowedMicroScenarios || [];
  const normalizedTrigger = String(trigger || "").toLowerCase();
  let matched = null;

  if ((normalizedTrigger.includes("inspect") || normalizedTrigger.includes("interactable")) && allowed.includes("revealed_route")) {
    matched = "revealed_route";
  } else if ((normalizedTrigger.includes("speak") || normalizedTrigger.includes("npc")) && allowed.includes("npc_alarm")) {
    matched = "npc_alarm";
  } else if ((normalizedTrigger.includes("declare") || normalizedTrigger.includes("transition")) && allowed.includes("pressure_tick")) {
    matched = "pressure_tick";
  }

  if (!matched) {
    return null;
  }

  return {
    scenarioKey: matched,
    summary: `The scene shifts through ${matched.replace(/_/g, " ")}.`,
    pressureDelta: matched === "pressure_tick" || matched === "npc_alarm" ? 1 : 0,
    changedCells: [],
    activateTransitionAnchors: matched === "revealed_route",
  };
}
