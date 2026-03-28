import { buildSceneMapLayout } from "../../../shared/mapTemplates";

function cellKey(x, y) {
  return `${x}:${y}`;
}

function inferTransitionAnchors(layout) {
  return [...layout.cells.values()]
    .filter((cell) => cell.kind === "doorway")
    .map((cell, index) => ({
      anchorId: `${cellKey(cell.x, cell.y)}:${index}`,
      label: cell.label || `Exit ${index + 1}`,
      x: cell.x,
      y: cell.y,
      type: "door",
      destinationSceneOrder: null,
      requiresTransitionUnlock: true,
      blockerReason: "The party has not completed this scene yet.",
      isActive: false,
    }));
}

function normalizeLandmarks(layout) {
  return (layout.landmarks || []).map((landmark, index) => ({
    landmarkId: `${index}:${landmark.name}`,
    name: landmark.name,
    cells: landmark.cells,
  }));
}

export function buildSceneMapInstance(scene) {
  const layout = buildSceneMapLayout(scene);
  const cells = [...layout.cells.values()].map((cell) => ({
    x: cell.x,
    y: cell.y,
    terrainKind: cell.kind,
    walkable: !cell.blocked,
    blocked: Boolean(cell.blocked),
    losBlocker: ["wall", "building", "pillar", "cliff"].includes(cell.kind),
    interactableId: scene.interactables?.find(
      (entry) => entry.position?.x === cell.x && entry.position?.y === cell.y,
    )?.id,
    landmarkId: normalizeLandmarks(layout).find((landmark) =>
      landmark.cells.some(([x, y]) => x === cell.x && y === cell.y),
    )?.landmarkId,
    hazardState: cell.kind === "hazard" ? "armed" : undefined,
    doorState: cell.kind === "doorway" ? "closed" : undefined,
    variantState: undefined,
    visibilityState: "visible",
  }));
  return {
    templateKey: scene.mapTemplateKey || scene.type || "fallback",
    width: layout.width,
    height: layout.height,
    cells,
    landmarks: normalizeLandmarks(layout),
    transitionAnchors: inferTransitionAnchors(layout),
    revealedInteractableIds: (scene.interactables || []).filter((entry) => !entry.hidden).map((entry) => entry.id),
    changedCells: [],
  };
}

export async function ensureSceneMapInstance(ctx, { scene }) {
  const existing = await ctx.db
    .query("sceneMapInstances")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .unique();
  if (existing) {
    return existing;
  }
  const instance = buildSceneMapInstance(scene);
  const mapId = await ctx.db.insert("sceneMapInstances", {
    sceneId: scene._id,
    templateKey: instance.templateKey,
    version: 1,
    width: instance.width,
    height: instance.height,
    cells: instance.cells,
    landmarks: instance.landmarks,
    transitionAnchors: instance.transitionAnchors,
    revealedInteractableIds: instance.revealedInteractableIds,
    changedCells: instance.changedCells,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ctx.db.get(mapId);
}

export async function getSceneMapInstance(ctx, sceneId) {
  return ctx.db
    .query("sceneMapInstances")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .unique();
}

export function getMapCellByCoordinates(mapInstance, x, y) {
  return mapInstance?.cells?.find((cell) => cell.x === x && cell.y === y) || null;
}

export function getTransitionAnchorForCell(mapInstance, x, y) {
  return (
    mapInstance?.transitionAnchors?.find((anchor) => anchor.x === x && anchor.y === y) || null
  );
}
