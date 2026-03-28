function inferNpcRevealList(npc) {
  const role = String(npc?.role || "").toLowerCase();
  if (role.includes("witness") || role.includes("scout")) {
    return ["route", "suspicion", "safe passage"];
  }
  if (role.includes("captain") || role.includes("commander")) {
    return ["threat posture", "enemy plan"];
  }
  if (role.includes("quest") || role.includes("giver") || role.includes("archivist")) {
    return ["mission context", "stakes", "known dangers"];
  }
  return ["local context"];
}

function inferNpcActions(npc) {
  const role = String(npc?.role || "").toLowerCase();
  if (role.includes("captain") || role.includes("commander")) {
    return ["warn", "threaten", "block", "retreat"];
  }
  if (role.includes("witness") || role.includes("scout")) {
    return ["reveal", "refuse", "bargain", "retreat"];
  }
  return ["reveal", "warn", "observe"];
}

export async function ensureSceneNpcStates(ctx, { scene }) {
  const existing = await ctx.db
    .query("sceneNpcStates")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .collect();
  if (existing.length) {
    return existing;
  }

  const now = Date.now();
  const briefs = scene.npcBriefs || [];
  await Promise.all(
    briefs.map((npc) =>
      ctx.db.insert("sceneNpcStates", {
        sceneId: scene._id,
        npcId: npc.name,
        sceneRole: npc.role,
        mood: "guarded",
        alertState: "watchful",
        trustByParty: 0,
        hostilityByParty: npc.role?.toLowerCase().includes("captain") ? 2 : 0,
        goal: npc.motive || npc.role || "hold position",
        canReveal: inferNpcRevealList(npc),
        canDo: inferNpcActions(npc),
        status: "active",
        createdAt: now,
        updatedAt: now,
      }),
    ),
  );

  return ctx.db
    .query("sceneNpcStates")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .collect();
}

export async function listSceneNpcStates(ctx, sceneId) {
  return ctx.db
    .query("sceneNpcStates")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .collect();
}

export async function getSceneNpcState(ctx, { sceneId, npcId }) {
  return ctx.db
    .query("sceneNpcStates")
    .withIndex("by_scene_npc", (q) => q.eq("sceneId", sceneId).eq("npcId", npcId))
    .unique();
}

export async function applyNpcStateDelta(ctx, { sceneId, npcId, trustDelta = 0, hostilityDelta = 0, mood, alertState }) {
  const npcState = await getSceneNpcState(ctx, { sceneId, npcId });
  if (!npcState) {
    return null;
  }

  await ctx.db.patch(npcState._id, {
    trustByParty: Math.max(-2, Math.min(5, (npcState.trustByParty || 0) + trustDelta)),
    hostilityByParty: Math.max(0, Math.min(5, (npcState.hostilityByParty || 0) + hostilityDelta)),
    mood: mood || npcState.mood,
    alertState: alertState || npcState.alertState,
    updatedAt: Date.now(),
  });

  return ctx.db.get(npcState._id);
}
