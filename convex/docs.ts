import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { authComponent } from "./auth";

const visibilityValidator = v.union(v.literal("private"), v.literal("public"));

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
// Public docs: anyone can view (even unauthenticated)
// Private docs: owner or members only
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
// Owner or editors can edit
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

// Get a single document by ID
// Returns null if doc doesn't exist OR if user doesn't have access
// This allows SSR to work - client will refetch with auth
export const get = query({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const userId = getUserId(user);

    const doc = await ctx.db.get(args.docId);
    if (!doc) return null;

    const hasAccess = await canView(ctx, doc, userId);
    if (!hasAccess) {
      // Return null instead of throwing - SSR may not have auth yet
      // Client will refetch with proper auth
      return null;
    }

    const hasEdit = await canEdit(ctx, doc, userId);

    return {
      ...doc,
      isOwner: userId !== null && doc.ownerId === userId,
      canEdit: hasEdit,
    };
  },
});

// List documents accessible to the current user
// If not authenticated, only returns public docs
// If authenticated, returns public + owned + shared docs
export const list = query({
  args: { query: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const userId = getUserId(user);
    const searchQuery = args.query?.trim();

    let docs: Doc<"documents">[];

    if (searchQuery) {
      // Search by title
      docs = await ctx.db
        .query("documents")
        .withSearchIndex("search_title", (s) => s.search("title", searchQuery))
        .take(100);
    } else {
      // Get all docs and filter by access
      const publicDocs = await ctx.db
        .query("documents")
        .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
        .collect();

      if (userId) {
        const ownedDocs = await ctx.db
          .query("documents")
          .withIndex("by_ownerId", (q) => q.eq("ownerId", userId))
          .collect();

        // Get docs where user is a member
        const memberships = await ctx.db
          .query("documentMembers")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .collect();

        const memberDocIds = new Set(memberships.map((m) => m.docId));
        const memberDocs: Doc<"documents">[] = [];
        for (const docId of memberDocIds) {
          const doc = await ctx.db.get(docId);
          if (doc) memberDocs.push(doc);
        }

        // Dedupe
        const seen = new Set<string>();
        docs = [];
        for (const doc of [...ownedDocs, ...memberDocs, ...publicDocs]) {
          if (seen.has(doc._id)) continue;
          seen.add(doc._id);
          docs.push(doc);
        }
      } else {
        docs = publicDocs;
      }
    }

    // Filter by access (for search results)
    const filtered: Doc<"documents">[] = [];
    for (const doc of docs) {
      if (await canView(ctx, doc, userId)) {
        filtered.push(doc);
      }
    }

    // Sort by updatedAt descending
    filtered.sort((a, b) => (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime));

    return filtered.map((doc) => ({
      _id: doc._id,
      _creationTime: doc._creationTime,
      title: doc.title,
      ownerId: doc.ownerId,
      visibility: doc.visibility,
      updatedAt: doc.updatedAt,
      isOwner: userId !== null && doc.ownerId === userId,
    }));
  },
});

// Create a new document
export const create = mutation({
  args: {
    title: v.optional(v.string()),
    visibility: v.optional(visibilityValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const docId = await ctx.db.insert("documents", {
      title: (args.title ?? "Untitled").trim() || "Untitled",
      ownerId: user._id,
      visibility: args.visibility ?? "private",
      updatedAt: now,
      lastSeq: 0,
    });

    return docId;
  },
});

// Update document title
export const updateTitle = mutation({
  args: {
    docId: v.id("documents"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.docId);

    if (!doc) {
      throw new ConvexError({ code: 404, message: "Document not found" });
    }

    // Only owner can update title
    if (doc.ownerId !== user._id) {
      throw new ConvexError({ code: 403, message: "Only owner can update title" });
    }

    await ctx.db.patch(args.docId, {
      title: args.title.trim() || "Untitled",
      updatedAt: Date.now(),
    });
  },
});

// Set document visibility
export const setVisibility = mutation({
  args: {
    docId: v.id("documents"),
    visibility: visibilityValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.docId);

    if (!doc) {
      throw new ConvexError({ code: 404, message: "Document not found" });
    }

    // Only owner can change visibility
    if (doc.ownerId !== user._id) {
      throw new ConvexError({ code: 403, message: "Only owner can change visibility" });
    }

    await ctx.db.patch(args.docId, {
      visibility: args.visibility,
      updatedAt: Date.now(),
    });
  },
});

// Delete a document
export const remove = mutation({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.docId);

    if (!doc) {
      throw new ConvexError({ code: 404, message: "Document not found" });
    }

    // Only owner can delete
    if (doc.ownerId !== user._id) {
      throw new ConvexError({ code: 403, message: "Only owner can delete document" });
    }

    // Delete all related data
    const updates = await ctx.db
      .query("documentUpdates")
      .withIndex("by_docId_seq", (q) => q.eq("docId", args.docId))
      .collect();
    for (const update of updates) {
      await ctx.db.delete(update._id);
    }

    const members = await ctx.db
      .query("documentMembers")
      .withIndex("by_docId", (q) => q.eq("docId", args.docId))
      .collect();
    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    const presence = await ctx.db
      .query("documentPresence")
      .withIndex("by_docId", (q) => q.eq("docId", args.docId))
      .collect();
    for (const p of presence) {
      await ctx.db.delete(p._id);
    }

    await ctx.db.delete(args.docId);
  },
});

