export async function getCurrentAppUser(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  return ctx.db
    .query("appUsers")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

export async function getOrCreateAppUser(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required.");
  }

  const now = Date.now();
  const existing = await getCurrentAppUser(ctx);

  const payload = {
    tokenIdentifier: identity.tokenIdentifier,
    subject: identity.subject,
    issuer: identity.issuer,
    email: identity.email ?? undefined,
    displayName: identity.name ?? identity.nickname ?? identity.givenName ?? undefined,
    pictureUrl: identity.pictureUrl ?? undefined,
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return { ...existing, ...payload };
  }

  const userId = await ctx.db.insert("appUsers", {
    ...payload,
    createdAt: now,
  });
  return ctx.db.get(userId);
}
