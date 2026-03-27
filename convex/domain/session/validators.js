import { v } from "convex/values";

export const roomPrivacyValidator = v.union(v.literal("private"), v.literal("public"));

export const sessionStatusValidator = v.union(
  v.literal("lobby"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("archived"),
);

export const participantStatusValidator = v.union(
  v.literal("joined"),
  v.literal("ready"),
  v.literal("left"),
);

export const presenceStateValidator = v.union(
  v.literal("online"),
  v.literal("offline"),
  v.literal("reconnecting"),
);

