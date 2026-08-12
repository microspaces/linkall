import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";

async function withAuthors(
  ctx: QueryCtx,
  posts: Doc<"posts">[],
  userId?: Id<"users">,
) {
  return await Promise.all(
    posts.map(async (post) => {
      const author = await ctx.db.get(post.authorId);
      const vote = userId
        ? await ctx.db
            .query("postVotes")
            .withIndex("by_post_user", (q) =>
              q.eq("postId", post._id).eq("userId", userId),
            )
            .unique()
        : null;
      return { ...post, author, hasUpvoted: vote !== null };
    }),
  );
}

/** Top-level posts: the global feed, or a single group's wall/chat. */
export const feed = query({
  args: {
    groupId: v.optional(v.id("groups")),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { groupId, userId }) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .order("desc")
      .take(100);
    const topLevel = posts.filter((p) => p.parentId === undefined);
    return await withAuthors(ctx, topLevel, userId);
  },
});

/**
 * Community feed for the signed-in user: posts from every group they follow,
 * plus global posts (no groupId). Legacy main-page comments container.
 */
export const userFeed = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const groupIds = new Set(memberships.map((m) => m.groupId));

    const allPosts = await ctx.db.query("posts").order("desc").take(200);
    const topLevel = allPosts.filter(
      (p) =>
        p.parentId === undefined &&
        (p.groupId === undefined || groupIds.has(p.groupId)),
    );
    return await withAuthors(ctx, topLevel.slice(0, 100), userId);
  },
});

export const replies = query({
  args: {
    postId: v.id("posts"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { postId, userId }) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_parent", (q) => q.eq("parentId", postId))
      .collect();
    return await withAuthors(ctx, posts, userId);
  },
});

export const create = mutation({
  args: {
    authorId: v.id("users"),
    content: v.string(),
    groupId: v.optional(v.id("groups")),
    parentId: v.optional(v.id("posts")),
    title: v.optional(v.string()),
    kind: v.optional(v.union(v.literal("news"), v.literal("discussion"))),
  },
  handler: async (ctx, { authorId, content, groupId, parentId, title, kind }) => {
    const trimmed = content.trim();
    if (trimmed.length === 0) throw new Error("Post cannot be empty");

    const postId = await ctx.db.insert("posts", {
      authorId,
      content: trimmed,
      groupId,
      parentId,
      title: title?.trim() || undefined,
      kind: parentId ? undefined : kind,
      upvotes: 0,
      replyCount: 0,
    });

    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (parent) {
        await ctx.db.patch(parentId, { replyCount: parent.replyCount + 1 });
        if (parent.authorId !== authorId) {
          const author = await ctx.db.get(authorId);
          await ctx.db.insert("notifications", {
            userId: parent.authorId,
            message: `${author?.name ?? "Someone"} replied to your post`,
            isRead: false,
          });
        }
      }
    }
    return postId;
  },
});

export const toggleUpvote = mutation({
  args: { postId: v.id("posts"), userId: v.id("users") },
  handler: async (ctx, { postId, userId }) => {
    const post = await ctx.db.get(postId);
    if (!post) throw new Error("Post not found");

    const existing = await ctx.db
      .query("postVotes")
      .withIndex("by_post_user", (q) =>
        q.eq("postId", postId).eq("userId", userId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(postId, { upvotes: Math.max(0, post.upvotes - 1) });
    } else {
      await ctx.db.insert("postVotes", { postId, userId });
      await ctx.db.patch(postId, { upvotes: post.upvotes + 1 });
    }
  },
});
