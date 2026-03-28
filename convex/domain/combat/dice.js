export function inferAreaTemplate(profile) {
  const normalized = String(profile?.name || profile?.key || "").toLowerCase();
  if (normalized.includes("burning hands")) {
    return { shape: "cone", sizeFeet: 15 };
  }
  if (normalized.includes("fireball")) {
    return { shape: "radius", sizeFeet: 20 };
  }
  return { shape: "single", sizeFeet: profile?.rangeFeet || 5 };
}

export function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(formula, { critical = false } = {}) {
  const match = /^(\d+)d(\d+)([+-]\d+)?$/i.exec(formula.trim());
  if (!match) {
    throw new Error(`Unsupported dice formula: ${formula}`);
  }
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = Number(match[3] || 0);
  const actualCount = critical ? count * 2 : count;
  let total = modifier;
  const rolls = [];
  for (let index = 0; index < actualCount; index += 1) {
    const roll = rollDie(sides);
    rolls.push(roll);
    total += roll;
  }
  return { total, rolls, modifier, count: actualCount, sides };
}
