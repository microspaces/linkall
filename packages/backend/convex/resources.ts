import { query } from "./_generated/server";
import { v } from "convex/values";

/** Children of a node; top-level categories when parentId is omitted. */
export const children = query({
  args: { parentId: v.optional(v.id("resources")) },
  handler: async (ctx, { parentId }) => {
    const rows = await ctx.db
      .query("resources")
      .withIndex("by_parent", (q) => q.eq("parentId", parentId))
      .collect();
    return rows.sort((a, b) => a.order - b.order);
  },
});

/** A resource with its children and breadcrumb trail back to the root. */
export const get = query({
  args: { resourceId: v.id("resources") },
  handler: async (ctx, { resourceId }) => {
    const resource = await ctx.db.get(resourceId);
    if (!resource) return null;

    const childRows = await ctx.db
      .query("resources")
      .withIndex("by_parent", (q) => q.eq("parentId", resourceId))
      .collect();
    childRows.sort((a, b) => a.order - b.order);

    const breadcrumb = [];
    let cursor = resource.parentId;
    while (cursor) {
      const parent = await ctx.db.get(cursor);
      if (!parent) break;
      breadcrumb.unshift({ _id: parent._id, title: parent.title });
      cursor = parent.parentId;
    }

    return { ...resource, children: childRows, breadcrumb };
  },
});
