"use node";

import { generateAdventureBlueprintGraph } from "../../../lib/gameDirectorGraph";
import { normalizeAdventureBlueprint } from "../blueprintTypes";
import { applyWorldSeedToBlueprint } from "../promptDrivenBlueprint";

export async function runCreateRunGraph(input) {
  const blueprint = await generateAdventureBlueprintGraph(input);
  return normalizeAdventureBlueprint(applyWorldSeedToBlueprint(blueprint, input));
}
