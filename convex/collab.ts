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

// Check if user can edit a document
async function canEdit(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<"documents">,
  userId: string | null
): Promise<boolean> {
  if (!userId) return false;
  if (doc.ownerId === userId) return true;
  const role = await getMemberRole(ctx, doc._id, userId);
  return role === "editor";
}

// List document updates (for syncing Yjs state)
// Anyone who can view can list updates
// Returns empty array if no access (SSR-safe)
export const listUpdates = query({
  args: {
    docId: v.id("documents"),
    afterSeq: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const userId = getUserId(user);

    const doc = await ctx.db.get(args.docId);
    if (!doc) {
      return []; // SSR-safe
    }

    const hasAccess = await canView(ctx, doc, userId);
    if (!hasAccess) {
      return []; // SSR-safe
    }

    const afterSeq = args.afterSeq ?? 0;
    const limit = Math.min(args.limit ?? 128, 512);

    return await ctx.db
      .query("documentUpdates")
      .withIndex("by_docId_seq", (q) => q.eq("docId", args.docId).gt("seq", afterSeq))
      .order("asc")
      .take(limit);
  },
});

// Submit a document update (CRDT operation)
// Only editors and owners can submit updates
export const submitUpdate = mutation({
  args: {
    docId: v.id("documents"),
    update: v.bytes(),
    clientId: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userId = user._id;

    const doc = await ctx.db.get(args.docId);
    if (!doc) {
      throw new ConvexError({ code: 404, message: "Document not found" });
    }

    const hasEdit = await canEdit(ctx, doc, userId);
    if (!hasEdit) {
      throw new ConvexError({ code: 403, message: "View-only access" });
    }

    const now = Date.now();
    const nextSeq = (doc.lastSeq ?? 0) + 1;

    // Update document's lastSeq and updatedAt
    await ctx.db.patch(args.docId, {
      lastSeq: nextSeq,
      updatedAt: now,
    });

    // Insert the update
    await ctx.db.insert("documentUpdates", {
      docId: args.docId,
      seq: nextSeq,
      update: args.update,
      userId,
      clientId: args.clientId,
      createdAt: now,
    });

    return { seq: nextSeq };
  },
});

// Get the current sequence number for a document
// Returns seq: 0 if no access (SSR-safe)
export const getSeq = query({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const userId = getUserId(user);

    const doc = await ctx.db.get(args.docId);
    if (!doc) {
      return { seq: 0 }; // SSR-safe
    }

    const hasAccess = await canView(ctx, doc, userId);
    if (!hasAccess) {
      return { seq: 0 }; // SSR-safe
    }

    return { seq: doc.lastSeq ?? 0 };
  },
});

