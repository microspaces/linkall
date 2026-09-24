import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { HEADCASE_BITS, type HeadCaseBit } from "./headcaseBitsData";

const HEAD_CANVAS = { width: 1080, height: 1920 } as const;

async function ensureHeadLayout(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<{
  layoutId: Id<"layouts">;
  panelId: Id<"panels">;
  screenId: Id<"screens">;
}> {
  const layouts = await ctx.db.query("layouts").collect();
  let layout = layouts.find((l) => l.name === "Head" || l.name === "HeadCase");
  if (!layout) {
    const layoutId = await ctx.db.insert("layouts", {
      name: "Head",
      ownerId,
    });
    layout = (await ctx.db.get(layoutId))!;
  }
  const screens = await ctx.db
    .query("screens")
    .withIndex("by_layout", (q) => q.eq("layoutId", layout._id))
    .collect();
  let screen = screens.find((s) => s.name.toLowerCase() === "head");
  if (!screen) {
    const order = screens.reduce((m, s) => Math.max(m, s.order), -1) + 1;
    const screenId = await ctx.db.insert("screens", {
      layoutId: layout._id,
      name: "Head",
      order,
      width: HEAD_CANVAS.width,
      height: HEAD_CANVAS.height,
    });
    screen = (await ctx.db.get(screenId))!;
  }
  const panels = await ctx.db
    .query("panels")
    .withIndex("by_screen", (q) => q.eq("screenId", screen._id))
    .collect();
  let panelId = panels[0]?._id;
  if (!panelId) {
    panelId = await ctx.db.insert("panels", {
      screenId: screen._id,
      name: "Head",
      zIndex: 0,
      points: [
        { x: 0, y: 0 },
        { x: HEAD_CANVAS.width, y: 0 },
        { x: HEAD_CANVAS.width, y: HEAD_CANVAS.height },
        { x: 0, y: HEAD_CANVAS.height },
      ],
    });
  }
  return { layoutId: layout._id, panelId, screenId: screen._id };
}

/**
 * Map a HeadCase sheet Type/Category onto the existing HeadCase set-list
 * buckets (Intro, Bit, Sketch, Crowd, Callback) so the designer library and
 * performance picker use the same roundType vocabulary as locos.ts.
 */
export function headcaseRoundType(type: string, category: string): string {
  const t = type.trim().toLowerCase();
  const c = category.trim().toLowerCase();
  if (c === "callback") return "Callback";
  if (c === "sketch" || t.includes("sketch")) return "Sketch";
  if (t === "heckler" || c === "audience" || c === "interaction") return "Crowd";
  if (
    t === "prep" ||
    t === "info" ||
    c === "opener" ||
    c === "housekeeping" ||
    c === "writing"
  ) {
    return "Intro";
  }
  return "Bit";
}

export function headcaseKind(
  type: string,
  category: string,
): "bit" | "sketch" {
  const t = type.trim().toLowerCase();
  const c = category.trim().toLowerCase();
  if (c === "sketch" || t.includes("sketch")) return "sketch";
  return "bit";
}

function opt(s: string): string | undefined {
  const t = s.trim();
  return t ? t : undefined;
}

function catalogBlurb(bit: HeadCaseBit): string {
  return [bit.difficulty, bit.rating, bit.category, bit.type]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * Additive import of the 855-row HeadCase sheet into the existing
 * shows → scenes → effects library (plus comedyGames catalog rows).
 *
 *   pnpm --filter @linkall/backend exec convex run headcaseBits:seed --env-file .env.funfirst
 */
export const seed = mutation({
  args: {
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { offset, limit }) => {
    const users = await ctx.db.query("users").collect();
    const ownerId =
      users.find((u) => u.tier === "admin")?._id ??
      users.find((u) => u.handle === "dev")?._id ??
      users[0]?._id;
    if (!ownerId) {
      throw new Error("No users in deployment — run seed:funfirst first.");
    }

    const head = await ensureHeadLayout(ctx, ownerId);
    const start = Math.max(0, offset ?? 0);
    const end = Math.min(HEADCASE_BITS.length, start + (limit ?? HEADCASE_BITS.length));
    const slice = HEADCASE_BITS.slice(start, end);

    const existingShows = await ctx.db.query("shows").collect();
    const haveShow = new Set(
      existingShows.map((s) => s.sourceKey).filter((k): k is string => !!k),
    );
    const existingGames = await ctx.db.query("comedyGames").collect();
    const haveGame = new Set(
      existingGames.map((g) => g.sourceKey).filter((k): k is string => !!k),
    );

    let insertedShows = 0;
    let skippedShows = 0;
    let insertedGames = 0;
    let skippedGames = 0;

    for (const bit of slice) {
      const roundType = headcaseRoundType(bit.type, bit.category);
      const kind = headcaseKind(bit.type, bit.category);
      const description = bit.concept.trim() || bit.title;

      if (haveShow.has(bit.sourceKey)) {
        skippedShows++;
      } else {
        const showId = await ctx.db.insert("shows", {
          title: bit.title,
          description,
          tag: "headcase",
          kind,
          roundType,
          bitType: opt(bit.type),
          category: opt(bit.category),
          difficulty: opt(bit.difficulty),
          rating: opt(bit.rating),
          political: bit.political,
          todo: opt(bit.todo),
          techSteps: opt(bit.techSteps),
          notes: opt(bit.notes),
          assetsNeeded: opt(bit.assets),
          dialog: bit.dialog,
          sourceKey: bit.sourceKey,
          status: "draft",
          currentSceneIndex: 0,
          layoutId: head.layoutId,
          ownerId,
        });
        const sceneId = await ctx.db.insert("scenes", {
          showId,
          order: 0,
          title: "Outline",
          kind: "panels",
          content: bit.dialog,
          durationSec: 60,
        });
        await ctx.db.insert("effects", {
          sceneId,
          panelId: head.panelId,
          logicalPanelName: "MainContent",
          kind: "text",
          content: bit.dialog,
          startTime: 0,
          isEnabled: true,
        });
        haveShow.add(bit.sourceKey);
        insertedShows++;
      }

      if (haveGame.has(bit.sourceKey)) {
        skippedGames++;
      } else {
        await ctx.db.insert("comedyGames", {
          name: bit.title,
          roundType,
          shortDescription: catalogBlurb(bit) || undefined,
          suggestions: opt(bit.assets),
          ask: bit.dialog,
          description,
          tag: "headcase",
          difficulty: opt(bit.difficulty),
          rating: opt(bit.rating),
          category: opt(bit.category),
          sourceKey: bit.sourceKey,
        });
        haveGame.add(bit.sourceKey);
        insertedGames++;
      }
    }

    return {
      total: HEADCASE_BITS.length,
      offset: start,
      limit: slice.length,
      insertedShows,
      skippedShows,
      insertedGames,
      skippedGames,
    };
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_tag", (q) => q.eq("tag", "headcase"))
      .collect();
    const csvShows = shows.filter((s) => s.sourceKey?.startsWith("hc-csv:"));
    const games = await ctx.db
      .query("comedyGames")
      .withIndex("by_tag", (q) => q.eq("tag", "headcase"))
      .collect();
    const csvGames = games.filter((g) => g.sourceKey?.startsWith("hc-csv:"));
    return {
      headcaseShows: shows.length,
      csvShows: csvShows.length,
      headcaseGames: games.length,
      csvGames: csvGames.length,
    };
  },
});
