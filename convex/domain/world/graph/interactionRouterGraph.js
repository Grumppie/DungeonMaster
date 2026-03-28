export function inferPromptMode(promptMode, content, combat) {
  if (promptMode && promptMode !== "auto") {
    return promptMode;
  }

  const normalized = content.trim().toLowerCase();
  const actionHints = [
    "attack",
    "cast",
    "move",
    "dash",
    "shoot",
    "swing",
    "stab",
    "fire bolt",
    "burning hands",
    "healing word",
    "end turn",
  ];
  if (combat?.encounter?.status === "active" && actionHints.some((hint) => normalized.includes(hint))) {
    return "declare";
  }
  if (normalized.includes("?") || normalized.startsWith("what ") || normalized.startsWith("can ")) {
    return "ask";
  }
  if (normalized.includes("look") || normalized.includes("inspect") || normalized.includes("search")) {
    return "inspect";
  }
  return "speak";
}
