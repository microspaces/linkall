import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Import Mike's SurroundShow designer data exported from surroundshow.com
 * (legacy LinkAll8 Show/Scene/Effect + Layout/Screen/Panel).
 *
 * Run via: node migrations/import-mike.mjs
 */

const point = v.object({ x: v.number(), y: v.number() });

const panelSpec = v.object({
  legacyId: v.number(),
  name: v.string(),
  zIndex: v.number(),
  points: v.array(point),
});

const screenSpec = v.object({
  legacyId: v.number(),
  name: v.string(),
  order: v.number(),
  width: v.number(),
  height: v.number(),
  panels: v.array(panelSpec),
});

const layoutSpec = v.object({
  legacyId: v.number(),
  name: v.string(),
  screens: v.array(screenSpec),
});

const effectSpec = v.object({
  legacyPanelId: v.number(),
  kind: v.union(
    v.literal("image"),
    v.literal("video"),
    v.literal("color"),
    v.literal("text"),
  ),
  content: v.string(),
  startTime: v.number(),
  isEnabled: v.boolean(),
});

const sceneSpec = v.object({
  legacyId: v.number(),
  title: v.string(),
  order: v.number(),
  durationSec: v.optional(v.number()),
  effects: v.array(effectSpec),
});

const showSpec = v.object({
  legacyId: v.number(),
  title: v.string(),
  description: v.string(),
  tag: v.optional(v.string()),
  legacyLayoutId: v.optional(v.number()),
  scenes: v.array(sceneSpec),
});

const payload = v.object({
  user: v.object({
    name: v.string(),
    handle: v.string(),
    bio: v.optional(v.string()),
    tier: v.union(
      v.literal("free"),
      v.literal("silver"),
      v.literal("gold"),
      v.literal("admin"),
    ),
  }),
  layouts: v.array(layoutSpec),
  shows: v.array(showSpec),
  /** When true, delete existing rows owned by this user handle first. */
  replaceOwned: v.optional(v.boolean()),
});

export const mike = mutation({
  args: { data: payload },
  handler: async (ctx, { data }) => {
    // Find or create Mike
    const existing = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", data.user.handle))
      .unique();
    let ownerId: Id<"users">;
    if (existing) {
      ownerId = existing._id;
      await ctx.db.patch(ownerId, {
        name: data.user.name,
        bio: data.user.bio,
        tier: data.user.tier,
      });
    } else {
      ownerId = await ctx.db.insert("users", {
        name: data.user.name,
        handle: data.user.handle,
        bio: data.user.bio,
        tier: data.user.tier,
        avatarUrl: `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(data.user.handle)}`,
      });
    }

    if (data.replaceOwned) {
      await deleteOwnedDesignerData(ctx, ownerId);
    }

    const layoutMap = new Map<number, Id<"layouts">>();
    const panelMap = new Map<number, Id<"panels">>();

    for (const layout of data.layouts) {
      const layoutId = await ctx.db.insert("layouts", {
        name: layout.name,
        ownerId,
      });
      layoutMap.set(layout.legacyId, layoutId);

      for (const screen of layout.screens) {
        const screenId = await ctx.db.insert("screens", {
          layoutId,
          name: screen.name,
          order: screen.order,
          width: screen.width,
          height: screen.height,
        });
        for (const panel of screen.panels) {
          const panelId = await ctx.db.insert("panels", {
            screenId,
            name: panel.name,
            zIndex: panel.zIndex,
            points: panel.points,
          });
          panelMap.set(panel.legacyId, panelId);
        }
      }
    }

    let showCount = 0;
    let sceneCount = 0;
    let effectCount = 0;
    let skippedEffects = 0;

    for (const show of data.shows) {
      const layoutId =
        show.legacyLayoutId !== undefined
          ? layoutMap.get(show.legacyLayoutId)
          : undefined;
      const showId = await ctx.db.insert("shows", {
        title: show.title,
        description: show.description,
        tag: show.tag,
        status: "draft",
        currentSceneIndex: 0,
        layoutId,
        ownerId,
      });
      showCount++;

      for (const scene of show.scenes) {
        const sceneId = await ctx.db.insert("scenes", {
          showId,
          order: scene.order,
          title: scene.title,
          kind: "panels",
          content: "",
          durationSec: scene.durationSec,
        });
        sceneCount++;

        for (const effect of scene.effects) {
          const panelId = panelMap.get(effect.legacyPanelId);
          if (!panelId) {
            skippedEffects++;
            continue;
          }
          await ctx.db.insert("effects", {
            sceneId,
            panelId,
            kind: effect.kind,
            content: effect.content,
            startTime: effect.startTime,
            isEnabled: effect.isEnabled,
          });
          effectCount++;
        }
      }
    }

    return {
      ownerId,
      layouts: layoutMap.size,
      panels: panelMap.size,
      shows: showCount,
      scenes: sceneCount,
      effects: effectCount,
      skippedEffects,
    };
  },
});

async function deleteOwnedDesignerData(ctx: MutationCtx, ownerId: Id<"users">) {
  const shows = (await ctx.db.query("shows").collect()).filter(
    (s) => s.ownerId === ownerId,
  );
  for (const show of shows) {
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", show._id))
      .collect();
    for (const scene of scenes) {
      const effects = await ctx.db
        .query("effects")
        .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
        .collect();
      for (const effect of effects) await ctx.db.delete(effect._id);
      await ctx.db.delete(scene._id);
    }
    await ctx.db.delete(show._id);
  }

  const layouts = (await ctx.db.query("layouts").collect()).filter(
    (l) => l.ownerId === ownerId,
  );
  for (const layout of layouts) {
    const screens = await ctx.db
      .query("screens")
      .withIndex("by_layout", (q) => q.eq("layoutId", layout._id))
      .collect();
    for (const screen of screens) {
      const panels = await ctx.db
        .query("panels")
        .withIndex("by_screen", (q) => q.eq("screenId", screen._id))
        .collect();
      for (const panel of panels) {
        const effects = await ctx.db
          .query("effects")
          .withIndex("by_panel", (q) => q.eq("panelId", panel._id))
          .collect();
        for (const effect of effects) await ctx.db.delete(effect._id);
        await ctx.db.delete(panel._id);
      }
      await ctx.db.delete(screen._id);
    }
    await ctx.db.delete(layout._id);
  }

  const profiles = (await ctx.db.query("displayProfiles").collect()).filter(
    (p) => p.ownerId === ownerId,
  );
  for (const profile of profiles) await ctx.db.delete(profile._id);
}
