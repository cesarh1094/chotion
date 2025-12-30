import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";

const roleValidator = v.union(v.literal("editor"), v.literal("viewer"));

// Get current user, throws if not authenticated
async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.getAuthUser(ctx);
  if (!user) throw new ConvexError({ code: 401, message: "Authentication required" });
  return user;
}

// List all members of a document (owner only)
export const list = query({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.docId);

    if (!doc) {
      throw new ConvexError({ code: 404, message: "Document not found" });
    }

    if (doc.ownerId !== user._id) {
      throw new ConvexError({ code: 403, message: "Only owner can view members" });
    }

    const members = await ctx.db
      .query("documentMembers")
      .withIndex("by_docId", (q) => q.eq("docId", args.docId))
      .collect();

    return members;
  },
});

// Add a member to a document (owner only)
export const add = mutation({
  args: {
    docId: v.id("documents"),
    userId: v.string(),
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.docId);

    if (!doc) {
      throw new ConvexError({ code: 404, message: "Document not found" });
    }

    if (doc.ownerId !== user._id) {
      throw new ConvexError({ code: 403, message: "Only owner can add members" });
    }

    // Can't add owner as member
    if (args.userId === doc.ownerId) {
      throw new ConvexError({ code: 400, message: "Cannot add owner as member" });
    }

    // Check if already a member
    const existing = await ctx.db
      .query("documentMembers")
      .withIndex("by_docId_userId", (q) => q.eq("docId", args.docId).eq("userId", args.userId))
      .unique();

    if (existing) {
      // Update role
      await ctx.db.patch(existing._id, { role: args.role });
      return existing._id;
    }

    return await ctx.db.insert("documentMembers", {
      docId: args.docId,
      userId: args.userId,
      role: args.role,
      addedAt: Date.now(),
    });
  },
});

// Remove a member from a document (owner only)
export const remove = mutation({
  args: {
    docId: v.id("documents"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.docId);

    if (!doc) {
      throw new ConvexError({ code: 404, message: "Document not found" });
    }

    if (doc.ownerId !== user._id) {
      throw new ConvexError({ code: 403, message: "Only owner can remove members" });
    }

    const member = await ctx.db
      .query("documentMembers")
      .withIndex("by_docId_userId", (q) => q.eq("docId", args.docId).eq("userId", args.userId))
      .unique();

    if (member) {
      await ctx.db.delete(member._id);
    }
  },
});

// Update a member's role (owner only)
export const updateRole = mutation({
  args: {
    docId: v.id("documents"),
    userId: v.string(),
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.docId);

    if (!doc) {
      throw new ConvexError({ code: 404, message: "Document not found" });
    }

    if (doc.ownerId !== user._id) {
      throw new ConvexError({ code: 403, message: "Only owner can update member roles" });
    }

    const member = await ctx.db
      .query("documentMembers")
      .withIndex("by_docId_userId", (q) => q.eq("docId", args.docId).eq("userId", args.userId))
      .unique();

    if (!member) {
      throw new ConvexError({ code: 404, message: "Member not found" });
    }

    await ctx.db.patch(member._id, { role: args.role });
  },
});

