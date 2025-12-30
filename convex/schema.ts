import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Documents table: stores document metadata
  documents: defineTable({
    title: v.string(),
    ownerId: v.string(),
    visibility: v.union(v.literal("private"), v.literal("public")),
    updatedAt: v.number(),
    lastSeq: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_visibility", ["visibility"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["ownerId", "visibility"],
    }),

  // Document members: editors/viewers for shared docs
  documentMembers: defineTable({
    docId: v.id("documents"),
    userId: v.string(),
    role: v.union(v.literal("editor"), v.literal("viewer")),
    addedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_docId", ["docId"])
    .index("by_docId_userId", ["docId", "userId"]),

  // Document updates: CRDT operation log for collaborative editing
  documentUpdates: defineTable({
    docId: v.id("documents"),
    seq: v.number(),
    update: v.bytes(),
    userId: v.string(),
    clientId: v.number(),
    createdAt: v.number(),
  }).index("by_docId_seq", ["docId", "seq"]),

  // Document presence: tracks who's viewing/editing each doc
  documentPresence: defineTable({
    docId: v.id("documents"),
    userId: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_docId", ["docId"])
    .index("by_docId_userId", ["docId", "userId"]),
});



