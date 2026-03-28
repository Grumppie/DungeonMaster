"use node";

import { generateAdventureBlueprintGraph } from "../../../lib/gameDirectorGraph";
import { normalizeAdventureBlueprint } from "../blueprintTypes";

export async function runCreateRunGraph(input) {
  const blueprint = await generateAdventureBlueprintGraph(input);
  return normalizeAdventureBlueprint(blueprint);
}
