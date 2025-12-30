import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";

// Get current user, returns null if not authenticated
async function getUser(ctx: QueryCtx | MutationCtx) {
  try {
    return await authComponent.getAuthUser(ctx);
  } catch {
    return null;
  }
}

// Get current user, throws if not authenticated
async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await getUser(ctx);
  if (!user) throw new ConvexError({ code: 401, message: "Authentication required" });
  return user;
}

// Get user ID as string from user object
function getUserId(user: { _id: string } | null): string | null {
  return user?._id ?? null;
}

// Check if user is a member of a document (editor or viewer)
async function getMemberRole(
  ctx: QueryCtx | MutationCtx,
  docId: Id<"documents">,
  userId: string
): Promise<"editor" | "viewer" | null> {
  const member = await ctx.db
    .query("documentMembers")
    .withIndex("by_docId_userId", (q) => q.eq("docId", docId).eq("userId", userId))
    .unique();
  return member?.role ?? null;
}

// Check if user can view a document
async function canView(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<"documents">,
  userId: string | null
): Promise<boolean> {
  if (doc.visibility === "public") return true;
  if (!userId) return false;
  if (doc.ownerId === userId) return true;
  const role = await getMemberRole(ctx, doc._id, userId);
  return role !== null;
}

// Presence timeout: users are considered "active" if updated within this window
const PRESENCE_TIMEOUT_MS = 30_000; // 30 seconds

// List all active users viewing a document
// Returns empty array if no access (SSR-safe)
export const list = query({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const userId = getUserId(user);

    const doc = await ctx.db.get(args.docId);
    if (!doc) {
      return []; // Return empty for SSR compatibility
    }

    const hasAccess = await canView(ctx, doc, userId);
    if (!hasAccess) {
      return []; // Return empty for SSR compatibility
    }

    const now = Date.now();
    const cutoff = now - PRESENCE_TIMEOUT_MS;

    const allPresence = await ctx.db
      .query("documentPresence")
      .withIndex("by_docId", (q) => q.eq("docId", args.docId))
      .collect();

    // Filter to only active users and sort by most recent
    return allPresence
      .filter((p) => p.updatedAt >= cutoff)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// Heartbeat: update or create presence for current user
// Only authenticated users can have presence
export const heartbeat = mutation({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = user._id;

    const doc = await ctx.db.get(args.docId);
    if (!doc) {
      throw new ConvexError({ code: 404, message: "Document not found" });
    }

    const hasAccess = await canView(ctx, doc, userId);
    if (!hasAccess) {
      throw new ConvexError({ code: 403, message: "Access denied" });
    }

    const now = Date.now();
    const name = String(user.name ?? user.email ?? "User");
    const image = user.image ? String(user.image) : undefined;

    // Check if presence already exists
    const existing = await ctx.db
      .query("documentPresence")
      .withIndex("by_docId_userId", (q) => q.eq("docId", args.docId).eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        updatedAt: now,
        name,
        image,
      });
      return existing._id;
    }

    return await ctx.db.insert("documentPresence", {
      docId: args.docId,
      userId,
      name,
      image,
      updatedAt: now,
    });
  },
});

// Leave: remove presence for current user when they leave the document
export const leave = mutation({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = user._id;

    const existing = await ctx.db
      .query("documentPresence")
      .withIndex("by_docId_userId", (q) => q.eq("docId", args.docId).eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Cleanup: remove stale presence entries (can be called periodically)
// This is a helper for maintenance
export const cleanup = mutation({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = user._id;

    const doc = await ctx.db.get(args.docId);
    if (!doc) return;

    // Only owner can cleanup
    if (doc.ownerId !== userId) return;

    const now = Date.now();
    const cutoff = now - PRESENCE_TIMEOUT_MS * 2; // Double timeout for cleanup

    const stale = await ctx.db
      .query("documentPresence")
      .withIndex("by_docId", (q) => q.eq("docId", args.docId))
      .collect();

    for (const p of stale) {
      if (p.updatedAt < cutoff) {
        await ctx.db.delete(p._id);
      }
    }
  },
});

