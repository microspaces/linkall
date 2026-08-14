import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

const statusValidator = v.union(
  v.literal("proposed"),
  v.literal("implementing"),
  v.literal("working"),
  v.literal("stalled"),
);

async function withAuthor(ctx: QueryCtx, authorId: Id<"users">) {
  return await ctx.db.get(authorId);
}

async function hasSolutionVote(
  ctx: QueryCtx,
  solutionId: Id<"solutions">,
  userId?: Id<"users">,
) {
  if (!userId) return false;
  const vote = await ctx.db
    .query("solutionVotes")
    .withIndex("by_solution_user", (q) =>
      q.eq("solutionId", solutionId).eq("userId", userId),
    )
    .unique();
  return vote !== null;
}

async function decorateSolution(
  ctx: QueryCtx,
  solution: Doc<"solutions">,
  userId?: Id<"users">,
) {
  const [author, group, hasUpvoted] = await Promise.all([
    withAuthor(ctx, solution.authorId),
    solution.groupId ? ctx.db.get(solution.groupId) : Promise.resolve(null),
    hasSolutionVote(ctx, solution._id, userId),
  ]);
  return { ...solution, author, group, hasUpvoted };
}

export const list = query({
  args: {
    status: v.optional(statusValidator),
    category: v.optional(v.string()),
    groupId: v.optional(v.id("groups")),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { status, category, groupId, userId }) => {
    let rows: Doc<"solutions">[];
    if (groupId) {
      rows = await ctx.db
        .query("solutions")
        .withIndex("by_group", (q) => q.eq("groupId", groupId))
        .order("desc")
        .collect();
    } else if (status) {
      rows = await ctx.db
        .query("solutions")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .collect();
    } else if (category) {
      rows = await ctx.db
        .query("solutions")
        .withIndex("by_category", (q) => q.eq("category", category))
        .order("desc")
        .collect();
    } else {
      rows = await ctx.db.query("solutions").order("desc").collect();
    }
    if (status && groupId) rows = rows.filter((s) => s.status === status);
    if (category && (groupId || status))
      rows = rows.filter((s) => s.category === category);
    return await Promise.all(
      rows.map((s) => decorateSolution(ctx, s, userId)),
    );
  },
});

export const get = query({
  args: {
    solutionId: v.id("solutions"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { solutionId, userId }) => {
    const solution = await ctx.db.get(solutionId);
    if (!solution) return null;
    const decorated = await decorateSolution(ctx, solution, userId);
    const responses = await ctx.db
      .query("solutionResponses")
      .withIndex("by_solution", (q) => q.eq("solutionId", solutionId))
      .collect();
    const decoratedResponses = await Promise.all(
      responses.map(async (r) => {
        const author = await withAuthor(ctx, r.authorId);
        const vote = userId
          ? await ctx.db
              .query("solutionResponseVotes")
              .withIndex("by_response_user", (q) =>
                q.eq("responseId", r._id).eq("userId", userId),
              )
              .unique()
          : null;
        return { ...r, author, hasUpvoted: vote !== null };
      }),
    );
    decoratedResponses.sort((a, b) => {
      if (a.isWorking !== b.isWorking) return a.isWorking ? -1 : 1;
      if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
      return a._creationTime - b._creationTime;
    });
    return { ...decorated, responses: decoratedResponses };
  },
});

export const create = mutation({
  args: {
    authorId: v.id("users"),
    title: v.string(),
    body: v.string(),
    category: v.string(),
    status: v.optional(statusValidator),
    groupId: v.optional(v.id("groups")),
    successNote: v.optional(v.string()),
    outcome: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim();
    const body = args.body.trim();
    if (!title) throw new Error("Title is required");
    if (!body) throw new Error("Describe the solution");
    return await ctx.db.insert("solutions", {
      title,
      body,
      category: args.category.trim() || "general",
      status: args.status ?? "proposed",
      authorId: args.authorId,
      groupId: args.groupId,
      successNote: args.successNote?.trim() || undefined,
      outcome: args.outcome?.trim() || undefined,
      upvotes: 0,
      responseCount: 0,
    });
  },
});

export const addResponse = mutation({
  args: {
    solutionId: v.id("solutions"),
    authorId: v.id("users"),
    body: v.string(),
  },
  handler: async (ctx, { solutionId, authorId, body }) => {
    const solution = await ctx.db.get(solutionId);
    if (!solution) throw new Error("Solution not found");
    const trimmed = body.trim();
    if (!trimmed) throw new Error("Response cannot be empty");
    const responseId = await ctx.db.insert("solutionResponses", {
      solutionId,
      authorId,
      body: trimmed,
      isWorking: false,
      upvotes: 0,
    });
    await ctx.db.patch(solutionId, {
      responseCount: solution.responseCount + 1,
    });
    if (solution.authorId !== authorId) {
      const author = await ctx.db.get(authorId);
      await ctx.db.insert("notifications", {
        userId: solution.authorId,
        message: `${author?.name ?? "Someone"} responded to "${solution.title}"`,
        isRead: false,
      });
    }
    return responseId;
  },
});

/** Mark or unmark a response as a working solution (Stack Overflow accept). */
export const toggleWorking = mutation({
  args: {
    responseId: v.id("solutionResponses"),
    userId: v.id("users"),
  },
  handler: async (ctx, { responseId, userId }) => {
    const response = await ctx.db.get(responseId);
    if (!response) throw new Error("Response not found");
    const solution = await ctx.db.get(response.solutionId);
    if (!solution) throw new Error("Solution not found");
    const user = await ctx.db.get(userId);
    const canMark =
      userId === solution.authorId || user?.tier === "admin";
    if (!canMark) throw new Error("Only the author or an admin can mark a working solution");

    const next = !response.isWorking;
    await ctx.db.patch(responseId, { isWorking: next });

    if (next && solution.status === "proposed") {
      await ctx.db.patch(solution._id, { status: "working" });
    }
    if (!next) {
      const siblings = await ctx.db
        .query("solutionResponses")
        .withIndex("by_solution", (q) => q.eq("solutionId", solution._id))
        .collect();
      const stillWorking = siblings.some(
        (s) => s._id !== responseId && s.isWorking,
      );
      if (!stillWorking && solution.status === "working") {
        await ctx.db.patch(solution._id, { status: "implementing" });
      }
    }
  },
});

export const setStatus = mutation({
  args: {
    solutionId: v.id("solutions"),
    userId: v.id("users"),
    status: statusValidator,
  },
  handler: async (ctx, { solutionId, userId, status }) => {
    const solution = await ctx.db.get(solutionId);
    if (!solution) throw new Error("Solution not found");
    const user = await ctx.db.get(userId);
    if (userId !== solution.authorId && user?.tier !== "admin") {
      throw new Error("Only the author or an admin can update status");
    }
    await ctx.db.patch(solutionId, { status });
  },
});

export const setSuccess = mutation({
  args: {
    solutionId: v.id("solutions"),
    userId: v.id("users"),
    outcome: v.optional(v.string()),
    successNote: v.optional(v.string()),
  },
  handler: async (ctx, { solutionId, userId, outcome, successNote }) => {
    const solution = await ctx.db.get(solutionId);
    if (!solution) throw new Error("Solution not found");
    const user = await ctx.db.get(userId);
    if (userId !== solution.authorId && user?.tier !== "admin") {
      throw new Error("Only the author or an admin can update success tracking");
    }
    await ctx.db.patch(solutionId, {
      outcome: outcome?.trim() || undefined,
      successNote: successNote?.trim() || undefined,
    });
  },
});

export const toggleUpvote = mutation({
  args: { solutionId: v.id("solutions"), userId: v.id("users") },
  handler: async (ctx, { solutionId, userId }) => {
    const solution = await ctx.db.get(solutionId);
    if (!solution) throw new Error("Solution not found");
    const existing = await ctx.db
      .query("solutionVotes")
      .withIndex("by_solution_user", (q) =>
        q.eq("solutionId", solutionId).eq("userId", userId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(solutionId, {
        upvotes: Math.max(0, solution.upvotes - 1),
      });
    } else {
      await ctx.db.insert("solutionVotes", { solutionId, userId });
      await ctx.db.patch(solutionId, { upvotes: solution.upvotes + 1 });
    }
  },
});

export const toggleResponseUpvote = mutation({
  args: { responseId: v.id("solutionResponses"), userId: v.id("users") },
  handler: async (ctx, { responseId, userId }) => {
    const response = await ctx.db.get(responseId);
    if (!response) throw new Error("Response not found");
    const existing = await ctx.db
      .query("solutionResponseVotes")
      .withIndex("by_response_user", (q) =>
        q.eq("responseId", responseId).eq("userId", userId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(responseId, {
        upvotes: Math.max(0, response.upvotes - 1),
      });
    } else {
      await ctx.db.insert("solutionResponseVotes", { responseId, userId });
      await ctx.db.patch(responseId, { upvotes: response.upvotes + 1 });
    }
  },
});
