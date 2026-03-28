const DEFAULT_MAP_WIDTH = 12;
const DEFAULT_MAP_HEIGHT = 8;

function keyFor(x, y) {
  return `${x}:${y}`;
}

function createBaseLayout(width = DEFAULT_MAP_WIDTH, height = DEFAULT_MAP_HEIGHT, baseKind = "ground") {
  const cells = new Map();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cells.set(keyFor(x, y), {
        x,
        y,
        kind: baseKind,
        blocked: false,
        label: "",
      });
    }
  }
  return { width, height, cells, landmarks: [] };
}

function paintRect(layout, fromX, fromY, toX, toY, patch) {
  for (let y = fromY; y <= toY; y += 1) {
    for (let x = fromX; x <= toX; x += 1) {
      const cell = layout.cells.get(keyFor(x, y));
      if (!cell) {
        continue;
      }
      layout.cells.set(keyFor(x, y), { ...cell, ...patch });
    }
  }
}

function paintPoints(layout, points, patch) {
  for (const [x, y] of points) {
    const cell = layout.cells.get(keyFor(x, y));
    if (!cell) {
      continue;
    }
    layout.cells.set(keyFor(x, y), { ...cell, ...patch });
  }
}

function addLandmark(layout, name, cells) {
  layout.landmarks.push({ name, cells });
}

function buildTwilightCityAlley() {
  const layout = createBaseLayout(12, 8, "grass");

  paintRect(layout, 0, 2, 11, 4, { kind: "road" });
  paintRect(layout, 4, 0, 7, 7, { kind: "road" });

  paintRect(layout, 1, 0, 3, 1, { kind: "building", blocked: true });
  paintRect(layout, 8, 0, 10, 1, { kind: "building", blocked: true });
  paintRect(layout, 0, 5, 2, 7, { kind: "building", blocked: true });
  paintRect(layout, 9, 5, 11, 7, { kind: "building", blocked: true });

  paintPoints(layout, [[4, 0], [7, 0], [5, 7], [6, 7]], { kind: "doorway", blocked: false });
  paintPoints(layout, [[3, 2], [3, 3], [3, 4], [8, 2], [8, 3], [8, 4]], { kind: "wall", blocked: true });
  paintPoints(layout, [[1, 2], [10, 4]], { kind: "signpost", blocked: true });

  addLandmark(layout, "north archway", [[4, 0], [7, 0]]);
  addLandmark(layout, "south alley gate", [[5, 7], [6, 7]]);
  addLandmark(layout, "west notice board", [[1, 2]]);
  addLandmark(layout, "east corner sign", [[10, 4]]);

  return layout;
}

function buildIntroCauseway() {
  const layout = createBaseLayout(12, 8, "grass");

  paintRect(layout, 0, 3, 11, 4, { kind: "road" });
  paintRect(layout, 4, 0, 7, 7, { kind: "road" });
  paintRect(layout, 1, 0, 3, 2, { kind: "building", blocked: true });
  paintRect(layout, 8, 0, 10, 2, { kind: "building", blocked: true });
  paintRect(layout, 0, 5, 2, 7, { kind: "wall", blocked: true });
  paintRect(layout, 9, 5, 11, 7, { kind: "wall", blocked: true });
  paintPoints(layout, [[5, 0], [6, 0], [5, 7], [6, 7]], { kind: "doorway", blocked: false });
  paintPoints(layout, [[2, 3], [9, 4]], { kind: "signpost", blocked: true });

  addLandmark(layout, "north breach", [[5, 0], [6, 0]]);
  addLandmark(layout, "south staging gate", [[5, 7], [6, 7]]);
  addLandmark(layout, "west command post", [[2, 3]]);
  addLandmark(layout, "east briefing post", [[9, 4]]);

  return layout;
}

function buildInvestigationHall() {
  const layout = createBaseLayout(12, 8, "stone");

  paintRect(layout, 0, 0, 11, 0, { kind: "wall", blocked: true });
  paintRect(layout, 0, 7, 11, 7, { kind: "wall", blocked: true });
  paintRect(layout, 0, 0, 0, 7, { kind: "wall", blocked: true });
  paintRect(layout, 11, 0, 11, 7, { kind: "wall", blocked: true });

  paintRect(layout, 1, 1, 10, 6, { kind: "hall" });
  paintRect(layout, 3, 2, 4, 5, { kind: "pillar", blocked: true });
  paintRect(layout, 7, 2, 8, 5, { kind: "pillar", blocked: true });
  paintPoints(layout, [[5, 0], [6, 0], [5, 7], [6, 7]], { kind: "doorway", blocked: false });
  paintPoints(layout, [[1, 3], [10, 3]], { kind: "torch", blocked: true });

  addLandmark(layout, "north gate", [[5, 0], [6, 0]]);
  addLandmark(layout, "south gate", [[5, 7], [6, 7]]);
  addLandmark(layout, "western torch", [[1, 3]]);
  addLandmark(layout, "eastern torch", [[10, 3]]);
  addLandmark(layout, "left pillar block", [[3, 2], [4, 5]]);
  addLandmark(layout, "right pillar block", [[7, 2], [8, 5]]);

  return layout;
}

function buildInvestigationArchive() {
  const layout = createBaseLayout(12, 8, "stone");

  paintRect(layout, 0, 0, 11, 0, { kind: "wall", blocked: true });
  paintRect(layout, 0, 7, 11, 7, { kind: "wall", blocked: true });
  paintRect(layout, 0, 0, 0, 7, { kind: "wall", blocked: true });
  paintRect(layout, 11, 0, 11, 7, { kind: "wall", blocked: true });

  paintRect(layout, 1, 1, 10, 6, { kind: "hall" });
  paintRect(layout, 2, 1, 3, 6, { kind: "building", blocked: true });
  paintRect(layout, 8, 1, 9, 6, { kind: "building", blocked: true });
  paintRect(layout, 4, 2, 7, 5, { kind: "stone" });
  paintPoints(layout, [[5, 0], [6, 0], [5, 7], [6, 7]], { kind: "doorway", blocked: false });
  paintPoints(layout, [[4, 3], [7, 3]], { kind: "torch", blocked: true });

  addLandmark(layout, "north archive gate", [[5, 0], [6, 0]]);
  addLandmark(layout, "south archive gate", [[5, 7], [6, 7]]);
  addLandmark(layout, "west shelving block", [[2, 1], [3, 6]]);
  addLandmark(layout, "east shelving block", [[8, 1], [9, 6]]);
  addLandmark(layout, "central reading floor", [[4, 2], [7, 5]]);

  return layout;
}

function buildArenaBridge() {
  const layout = createBaseLayout(12, 8, "chasm");

  paintRect(layout, 2, 1, 9, 6, { kind: "bridge" });
  paintRect(layout, 4, 2, 7, 5, { kind: "lane" });
  paintRect(layout, 0, 0, 1, 7, { kind: "cliff", blocked: true });
  paintRect(layout, 10, 0, 11, 7, { kind: "cliff", blocked: true });
  paintPoints(layout, [[2, 3], [9, 4]], { kind: "barricade", blocked: true });
  paintPoints(layout, [[5, 1], [6, 6]], { kind: "doorway", blocked: false });

  addLandmark(layout, "upper bridge gate", [[5, 1]]);
  addLandmark(layout, "lower bridge gate", [[6, 6]]);
  addLandmark(layout, "west barricade", [[2, 3]]);
  addLandmark(layout, "east barricade", [[9, 4]]);
  addLandmark(layout, "central lane", [[4, 2], [7, 5]]);

  return layout;
}

function buildArenaSanctum() {
  const layout = createBaseLayout(12, 8, "stone");

  paintRect(layout, 0, 0, 11, 0, { kind: "wall", blocked: true });
  paintRect(layout, 0, 7, 11, 7, { kind: "wall", blocked: true });
  paintRect(layout, 0, 0, 0, 7, { kind: "wall", blocked: true });
  paintRect(layout, 11, 0, 11, 7, { kind: "wall", blocked: true });
  paintRect(layout, 1, 1, 10, 6, { kind: "hall" });
  paintRect(layout, 4, 2, 7, 5, { kind: "bridge" });
  paintPoints(layout, [[3, 3], [8, 4]], { kind: "barricade", blocked: true });
  paintPoints(layout, [[5, 0], [6, 0], [5, 7], [6, 7]], { kind: "doorway", blocked: false });
  paintPoints(layout, [[2, 2], [9, 2], [2, 5], [9, 5]], { kind: "torch", blocked: true });

  addLandmark(layout, "north sanctum gate", [[5, 0], [6, 0]]);
  addLandmark(layout, "south sanctum gate", [[5, 7], [6, 7]]);
  addLandmark(layout, "ritual bridge", [[4, 2], [7, 5]]);
  addLandmark(layout, "west barricade", [[3, 3]]);
  addLandmark(layout, "east barricade", [[8, 4]]);

  return layout;
}

function buildResolutionChamber() {
  const layout = createBaseLayout(12, 8, "hall");

  paintRect(layout, 0, 0, 11, 0, { kind: "wall", blocked: true });
  paintRect(layout, 0, 7, 11, 7, { kind: "wall", blocked: true });
  paintRect(layout, 0, 0, 0, 7, { kind: "wall", blocked: true });
  paintRect(layout, 11, 0, 11, 7, { kind: "wall", blocked: true });
  paintRect(layout, 1, 1, 10, 6, { kind: "hall" });
  paintRect(layout, 4, 2, 7, 5, { kind: "stone" });
  paintPoints(layout, [[5, 0], [6, 0]], { kind: "doorway", blocked: false });
  paintPoints(layout, [[5, 7], [6, 7]], { kind: "doorway", blocked: false });
  paintPoints(layout, [[3, 3], [8, 3]], { kind: "pillar", blocked: true });

  addLandmark(layout, "north chamber gate", [[5, 0], [6, 0]]);
  addLandmark(layout, "south chamber gate", [[5, 7], [6, 7]]);
  addLandmark(layout, "central dais", [[4, 2], [7, 5]]);
  addLandmark(layout, "left witness pillar", [[3, 3]]);
  addLandmark(layout, "right witness pillar", [[8, 3]]);

  return layout;
}

function buildFallbackExploration() {
  const layout = createBaseLayout(12, 8, "ground");
  paintRect(layout, 2, 2, 9, 5, { kind: "trail" });
  paintPoints(layout, [[5, 0], [6, 0], [5, 7], [6, 7]], { kind: "doorway", blocked: false });
  paintRect(layout, 0, 0, 1, 1, { kind: "wall", blocked: true });
  paintRect(layout, 10, 6, 11, 7, { kind: "wall", blocked: true });
  addLandmark(layout, "north passage", [[5, 0], [6, 0]]);
  addLandmark(layout, "south passage", [[5, 7], [6, 7]]);
  addLandmark(layout, "central trail", [[2, 2], [9, 5]]);
  return layout;
}

export function buildSceneMapLayout(activeScene) {
  const templateKey = String(activeScene?.mapTemplateKey || "").toLowerCase();
  const sceneType = String(activeScene?.type || "").toLowerCase();

  if (templateKey.includes("intro_causeway")) {
    return buildIntroCauseway();
  }
  if (templateKey.includes("twilight_city_alley")) {
    return buildTwilightCityAlley();
  }
  if (templateKey.includes("investigation_archive")) {
    return buildInvestigationArchive();
  }
  if (templateKey.includes("investigation_hall")) {
    return buildInvestigationHall();
  }
  if (templateKey.includes("arena_sanctum")) {
    return buildArenaSanctum();
  }
  if (templateKey.includes("arena_bridge")) {
    return buildArenaBridge();
  }
  if (templateKey.includes("resolution_chamber")) {
    return buildResolutionChamber();
  }
  if (templateKey.includes("fallback_exploration")) {
    return buildFallbackExploration();
  }
  if (sceneType === "combat") {
    return activeScene?.scenePurpose === "climax" ? buildArenaSanctum() : buildArenaBridge();
  }
  if (sceneType === "exploration" || sceneType === "investigation" || sceneType === "intro") {
    return sceneType === "intro" ? buildIntroCauseway() : buildInvestigationArchive();
  }
  if (sceneType === "resolution") {
    return buildResolutionChamber();
  }
  return createBaseLayout();
}

export function getSceneMapCell(activeScene, x, y) {
  const layout = buildSceneMapLayout(activeScene);
  return layout.cells.get(keyFor(x, y)) || null;
}

export function describeSceneMapLayout(activeScene) {
  const layout = buildSceneMapLayout(activeScene);
  const counts = new Map();
  for (const cell of layout.cells.values()) {
    counts.set(cell.kind, (counts.get(cell.kind) || 0) + 1);
  }

  const features = [];
  if (counts.get("road")) {
    features.push(`roads x${counts.get("road")}`);
  }
  if (counts.get("bridge")) {
    features.push(`bridge tiles x${counts.get("bridge")}`);
  }
  if (counts.get("hall")) {
    features.push(`hall floor x${counts.get("hall")}`);
  }
  if (counts.get("building")) {
    features.push(`building footprint x${counts.get("building")}`);
  }
  if (counts.get("wall")) {
    features.push(`wall tiles x${counts.get("wall")}`);
  }
  if (counts.get("pillar")) {
    features.push(`pillars x${counts.get("pillar")}`);
  }
  if (counts.get("doorway")) {
    features.push(`doorways x${counts.get("doorway")}`);
  }
  if (counts.get("torch")) {
    features.push(`torches x${counts.get("torch")}`);
  }
  if (counts.get("signpost")) {
    features.push(`signposts x${counts.get("signpost")}`);
  }
  if (counts.get("cliff")) {
    features.push(`cliff edges x${counts.get("cliff")}`);
  }
  if (counts.get("chasm")) {
    features.push(`chasm tiles x${counts.get("chasm")}`);
  }

  return {
    width: layout.width,
    height: layout.height,
    features,
    landmarks: layout.landmarks.map((entry) => ({
      name: entry.name,
      cells: entry.cells,
    })),
  };
}
