const DEFAULT_STALL_PLAN = {
  mode: "escalating_nudge",
  triggerAfterInteractions: 3,
};

function normalizeText(value, fallback) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

export function inferScenePurpose(scene, order, totalScenes) {
  if (scene.scenePurpose) {
    return scene.scenePurpose;
  }
  if (order === 1) {
    return "introduce";
  }
  if (order === totalScenes) {
    return scene.type === "combat" ? "climax" : "resolve";
  }
  if (scene.type === "combat") {
    return "threaten";
  }
  if (scene.type === "resolution") {
    return "resolve";
  }
  if (scene.type === "exploration") {
    return "reveal";
  }
  return "complicate";
}

export function inferActState(scene, order, totalScenes) {
  if (scene.actState) {
    return scene.actState;
  }
  if (order === 1) {
    return "approach";
  }
  if (order === totalScenes) {
    return scene.type === "resolution" ? "aftermath" : "climax";
  }
  if (order >= Math.max(3, totalScenes - 1)) {
    return "reveal";
  }
  return order === 2 ? "contact" : "complication";
}

export function inferPressureTier(scene, order, totalScenes) {
  const pressure = String(scene.pressure || "").toLowerCase();
  if (pressure.includes("critical")) {
    return "critical";
  }
  if (pressure.includes("high") || pressure.includes("mount")) {
    return "high";
  }
  if (order === totalScenes) {
    return "high";
  }
  if (order === 1) {
    return "low";
  }
  return "medium";
}

function inferRequiredDiscovery(scene) {
  if (scene.requiredDiscovery) {
    return scene.requiredDiscovery;
  }
  if (scene.type === "combat") {
    return "Read the threat and identify where the pressure is coming from.";
  }
  return `Learn the critical truth inside ${normalizeText(scene.title, "the current scene")}.`;
}

function inferRequiredCommitment(scene) {
  if (scene.requiredCommitment) {
    return scene.requiredCommitment;
  }
  if (scene.type === "combat") {
    return "Commit to the encounter and take decisive action on the board.";
  }
  if (scene.type === "resolution") {
    return "Choose the party's final response to what was uncovered.";
  }
  return `Act on what the party learns in ${normalizeText(scene.title, "the current scene")}.`;
}

function inferTransitionRule(scene) {
  if (scene.transitionRule) {
    return scene.transitionRule;
  }
  return {
    type: scene.type === "resolution" ? "complete_scene" : "anchor_unlock",
    anchorLabel: scene.type === "resolution" ? undefined : "exit",
  };
}

function inferThemeTags(scene) {
  const tags = new Set(Array.isArray(scene.themeTags) ? scene.themeTags : []);
  if (scene.type) {
    tags.add(String(scene.type).toLowerCase());
  }
  if (scene.enemyTheme) {
    tags.add("enemy_pressure");
  }
  return [...tags];
}

function inferAllowedMicroScenarios(scene) {
  if (Array.isArray(scene.allowedMicroScenarios) && scene.allowedMicroScenarios.length) {
    return scene.allowedMicroScenarios;
  }
  if (scene.type === "combat") {
    return ["enemy_reinforcement", "cover_shift", "hazard_trigger"];
  }
  if (scene.type === "resolution") {
    return ["claim_dispute", "aftermath_reveal"];
  }
  return ["revealed_route", "npc_alarm", "pressure_tick"];
}

function inferLandmarks(scene) {
  if (Array.isArray(scene.landmarks) && scene.landmarks.length) {
    return scene.landmarks;
  }
  return [];
}

export function normalizeSceneBlueprint(scene, order, totalScenes) {
  return {
    ...scene,
    order,
    title: normalizeText(scene.title, `Scene ${order}`),
    objective: normalizeText(scene.objective, "Make meaningful progress."),
    objectiveText: normalizeText(scene.objectiveText, normalizeText(scene.objective, "Make meaningful progress.")),
    summary: normalizeText(scene.summary, "The scene is active and waiting on the party."),
    pressure: normalizeText(scene.pressure, "steady"),
    encounterScale: normalizeText(scene.encounterScale, "none"),
    scenePurpose: inferScenePurpose(scene, order, totalScenes),
    actState: inferActState(scene, order, totalScenes),
    pressureTier: inferPressureTier(scene, order, totalScenes),
    requiredDiscovery: normalizeText(inferRequiredDiscovery(scene), "Learn what matters here."),
    requiredCommitment: normalizeText(inferRequiredCommitment(scene), "Commit to a consequential action."),
    stallRecoveryPlan: scene.stallRecoveryPlan || DEFAULT_STALL_PLAN,
    allowedMicroScenarios: inferAllowedMicroScenarios(scene),
    transitionRule: inferTransitionRule(scene),
    landmarks: inferLandmarks(scene),
    themeTags: inferThemeTags(scene),
  };
}

export function normalizeAdventureBlueprint(blueprint) {
  const scenes = Array.isArray(blueprint?.scenes) ? blueprint.scenes : [];
  const totalScenes = scenes.length;
  return {
    ...blueprint,
    title: normalizeText(blueprint?.title, "Untitled Adventure"),
    questHook: normalizeText(blueprint?.questHook, "The party is drawn into a fresh threat."),
    objective: normalizeText(blueprint?.objective, "See the current mission through."),
    summary: normalizeText(blueprint?.summary, "A dangerous run is underway."),
    scenes: scenes.map((scene, index) => normalizeSceneBlueprint(scene, index + 1, totalScenes)),
  };
}
