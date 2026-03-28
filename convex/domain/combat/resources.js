import { clone } from "./helpers";

export function consumeSpellSlot(resources, level) {
  const spellSlots = clone(resources.spellSlots || {});
  const remaining = Number(spellSlots[level] || 0);
  if (remaining <= 0) {
    throw new Error(`No spell slots remaining for level ${level}.`);
  }
  spellSlots[level] = remaining - 1;
  return { ...resources, spellSlots };
}

export function consumeResource(resources, resourceKey) {
  if (!resourceKey) {
    return resources;
  }
  const next = clone(resources);
  const resource = next[resourceKey];
  if (!resource || typeof resource !== "object") {
    throw new Error(`Missing resource: ${resourceKey}`);
  }
  if (typeof resource.usesRemaining !== "number" || resource.usesRemaining <= 0) {
    throw new Error(`No uses remaining for ${resourceKey}.`);
  }
  resource.usesRemaining -= 1;
  return next;
}
