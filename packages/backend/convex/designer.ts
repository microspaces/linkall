import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Show designer backend (legacy: Homeshow/Surroundshow Designer page).
 *
 * Two hierarchies, mirroring the legacy SQL model:
 *   content:  shows → scenes → effects (effect targets a panel)
 *   physical: layouts → screens → panels (panel = polygon on a screen)
 */

// ------------------------------------------------------------- queries

export const listLayouts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("layouts").collect();
  },
});

/** A layout with all its screens and their panels, ready to render. */
export const getLayout = query({
  args: { layoutId: v.id("layouts") },
  handler: async (ctx, { layoutId }) => {
    const layout = await ctx.db.get(layoutId);
    if (!layout) return null;
    return { ...layout, screens: await screensWithPanels(ctx, layoutId) };
  },
});

/** Scenes of a show in order, with per-scene effect counts. */
export const getShowScenes = query({
  args: { showId: v.id("shows") },
  handler: async (ctx, { showId }) => {
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", showId))
      .collect();
    scenes.sort((a, b) => a.order - b.order);
    return scenes;
  },
});

/** Effects of a scene joined with their panel + screen names. */
export const getSceneEffects = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, { sceneId }) => {
    const effects = await ctx.db
      .query("effects")
      .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
      .collect();
    const rows = [];
    for (const effect of effects) {
      const panel = await ctx.db.get(effect.panelId);
      const screen = panel ? await ctx.db.get(panel.screenId) : null;
      rows.push({
        ...effect,
        panelName: panel?.name ?? "(deleted panel)",
        screenName: screen?.name ?? "",
        screenId: screen?._id,
        zIndex: panel?.zIndex ?? 0,
      });
    }
    rows.sort((a, b) => a.zIndex - b.zIndex);
    return rows;
  },
});

/**
 * Everything one physical output (projector / LED wall) needs, in one
 * reactive query: the screen + its panels, the alignment state, and — if a
 * show targeting this screen's layout is live — the current scene and its
 * effects. This replaces the legacy SignalR DisplayHub messages: any change
 * (scene tap, panel nudge, alignment toggle) re-runs this query on the
 * screen page automatically.
 */
export const screenView = query({
  args: { screenId: v.id("screens") },
  handler: async (ctx, { screenId }) => {
    const screen = await ctx.db.get(screenId);
    if (!screen) return null;
    const panels = await ctx.db
      .query("panels")
      .withIndex("by_screen", (q) => q.eq("screenId", screenId))
      .collect();
    panels.sort((a, b) => a.zIndex - b.zIndex);
    const layout = await ctx.db.get(screen.layoutId);

    const liveShows = await ctx.db
      .query("shows")
      .withIndex("by_status", (q) => q.eq("status", "live"))
      .collect();
    const show = liveShows.find((s) => s.layoutId === screen.layoutId) ?? null;

    let scene: Doc<"scenes"> | null = null;
    let effects: Array<{
      panelId: Id<"panels">;
      kind: "image" | "video" | "color" | "text";
      content: string;
      startTime: number;
      isEnabled: boolean;
    }> = [];
    if (show) {
      const scenes = await ctx.db
        .query("scenes")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      scenes.sort((a, b) => a.order - b.order);
      scene = scenes[show.currentSceneIndex] ?? null;
      if (scene) {
        const sceneId = scene._id;
        effects = await ctx.db
          .query("effects")
          .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
          .collect();
      }
    }

    return {
      screen: { ...screen, panels },
      layoutName: layout?.name ?? "",
      show,
      scene,
      effects,
    };
  },
});

/** Toggle calibration mode for a panel on the physical output (or clear it). */
export const setAlignPanel = mutation({
  args: {
    screenId: v.id("screens"),
    panelId: v.optional(v.id("panels")),
  },
  handler: async (ctx, { screenId, panelId }) => {
    await ctx.db.patch(screenId, { alignPanelId: panelId });
  },
});

async function screensWithPanels(ctx: QueryCtx, layoutId: Id<"layouts">) {
  const screens = await ctx.db
    .query("screens")
    .withIndex("by_layout", (q) => q.eq("layoutId", layoutId))
    .collect();
  screens.sort((a, b) => a.order - b.order);
  const result = [];
  for (const screen of screens) {
    const panels = await ctx.db
      .query("panels")
      .withIndex("by_screen", (q) => q.eq("screenId", screen._id))
      .collect();
    panels.sort((a, b) => a.zIndex - b.zIndex);
    result.push({ ...screen, panels });
  }
  return result;
}

// ------------------------------------------------------- show mutations

export const updateShow = mutation({
  args: {
    showId: v.id("shows"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    layoutId: v.optional(v.id("layouts")),
  },
  handler: async (ctx, { showId, ...fields }) => {
    await ctx.db.patch(showId, fields);
  },
});

export const deleteShow = mutation({
  args: { showId: v.id("shows") },
  handler: async (ctx, { showId }) => {
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", showId))
      .collect();
    for (const scene of scenes) await deleteSceneCascade(ctx, scene._id);
    await ctx.db.delete(showId);
  },
});

// ------------------------------------------------------ scene mutations

export const createScene = mutation({
  args: {
    showId: v.id("shows"),
    title: v.string(),
    durationSec: v.number(),
  },
  handler: async (ctx, { showId, title, durationSec }) => {
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", showId))
      .collect();
    return await ctx.db.insert("scenes", {
      showId,
      title,
      kind: "panels",
      content: "",
      durationSec,
      order: scenes.length,
    });
  },
});

export const updateScene = mutation({
  args: {
    sceneId: v.id("scenes"),
    title: v.optional(v.string()),
    durationSec: v.optional(v.number()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, { sceneId, ...fields }) => {
    await ctx.db.patch(sceneId, fields);
  },
});

export const deleteScene = mutation({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, { sceneId }) => {
    await deleteSceneCascade(ctx, sceneId);
  },
});

async function deleteSceneCascade(ctx: MutationCtx, sceneId: Id<"scenes">) {
  const effects = await ctx.db
    .query("effects")
    .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
    .collect();
  for (const effect of effects) await ctx.db.delete(effect._id);
  await ctx.db.delete(sceneId);
}

// ----------------------------------------------------- effect mutations

export const createEffect = mutation({
  args: {
    sceneId: v.id("scenes"),
    panelId: v.id("panels"),
    kind: v.union(
      v.literal("image"),
      v.literal("video"),
      v.literal("color"),
      v.literal("text"),
    ),
    content: v.string(),
    startTime: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("effects", { ...args, isEnabled: true });
  },
});

export const updateEffect = mutation({
  args: {
    effectId: v.id("effects"),
    panelId: v.optional(v.id("panels")),
    kind: v.optional(
      v.union(
        v.literal("image"),
        v.literal("video"),
        v.literal("color"),
        v.literal("text"),
      ),
    ),
    content: v.optional(v.string()),
    startTime: v.optional(v.number()),
    isEnabled: v.optional(v.boolean()),
    durationSec: v.optional(v.number()),
  },
  handler: async (ctx, { effectId, ...fields }) => {
    await ctx.db.patch(effectId, fields);
  },
});

export const deleteEffect = mutation({
  args: { effectId: v.id("effects") },
  handler: async (ctx, { effectId }) => {
    await ctx.db.delete(effectId);
  },
});

// ----------------------------------------------------- layout mutations

export const createLayout = mutation({
  args: { name: v.string(), ownerId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.insert("layouts", args);
  },
});

export const updateLayout = mutation({
  args: { layoutId: v.id("layouts"), name: v.string() },
  handler: async (ctx, { layoutId, name }) => {
    await ctx.db.patch(layoutId, { name });
  },
});

export const deleteLayout = mutation({
  args: { layoutId: v.id("layouts") },
  handler: async (ctx, { layoutId }) => {
    const screens = await ctx.db
      .query("screens")
      .withIndex("by_layout", (q) => q.eq("layoutId", layoutId))
      .collect();
    for (const screen of screens) await deleteScreenCascade(ctx, screen._id);
    await ctx.db.delete(layoutId);
  },
});

// ----------------------------------------------------- screen mutations

export const createScreen = mutation({
  args: { layoutId: v.id("layouts"), name: v.string() },
  handler: async (ctx, { layoutId, name }) => {
    const screens = await ctx.db
      .query("screens")
      .withIndex("by_layout", (q) => q.eq("layoutId", layoutId))
      .collect();
    return await ctx.db.insert("screens", {
      layoutId,
      name,
      order: screens.length,
      width: 800,
      height: 600,
    });
  },
});

export const updateScreen = mutation({
  args: { screenId: v.id("screens"), name: v.string() },
  handler: async (ctx, { screenId, name }) => {
    await ctx.db.patch(screenId, { name });
  },
});

export const deleteScreen = mutation({
  args: { screenId: v.id("screens") },
  handler: async (ctx, { screenId }) => {
    await deleteScreenCascade(ctx, screenId);
  },
});

async function deleteScreenCascade(ctx: MutationCtx, screenId: Id<"screens">) {
  const panels = await ctx.db
    .query("panels")
    .withIndex("by_screen", (q) => q.eq("screenId", screenId))
    .collect();
  for (const panel of panels) {
    const effects = await ctx.db
      .query("effects")
      .withIndex("by_panel", (q) => q.eq("panelId", panel._id))
      .collect();
    for (const effect of effects) await ctx.db.delete(effect._id);
    await ctx.db.delete(panel._id);
  }
  await ctx.db.delete(screenId);
}

// ------------------------------------------------------ panel mutations

export const createPanel = mutation({
  args: { screenId: v.id("screens"), name: v.string() },
  handler: async (ctx, { screenId, name }) => {
    const panels = await ctx.db
      .query("panels")
      .withIndex("by_screen", (q) => q.eq("screenId", screenId))
      .collect();
    // New panels start as a centered rectangle the user can drag into shape.
    return await ctx.db.insert("panels", {
      screenId,
      name,
      zIndex: panels.length,
      points: [
        { x: 250, y: 200 },
        { x: 550, y: 200 },
        { x: 550, y: 400 },
        { x: 250, y: 400 },
      ],
    });
  },
});

export const updatePanel = mutation({
  args: {
    panelId: v.id("panels"),
    name: v.optional(v.string()),
    zIndex: v.optional(v.number()),
    points: v.optional(v.array(v.object({ x: v.number(), y: v.number() }))),
  },
  handler: async (ctx, { panelId, ...fields }) => {
    await ctx.db.patch(panelId, fields);
  },
});

export const deletePanel = mutation({
  args: { panelId: v.id("panels") },
  handler: async (ctx, { panelId }) => {
    const effects = await ctx.db
      .query("effects")
      .withIndex("by_panel", (q) => q.eq("panelId", panelId))
      .collect();
    for (const effect of effects) await ctx.db.delete(effect._id);
    await ctx.db.delete(panelId);
  },
});

// ------------------------------------------------- display profile mutations

export const listProfiles = query({
  args: { ownerId: v.id("users") },
  handler: async (ctx, { ownerId }) => {
    return await ctx.db
      .query("displayProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
  },
});

export const saveProfile = mutation({
  args: {
    name: v.string(),
    ownerId: v.id("users"),
    layoutId: v.id("layouts"),
  },
  handler: async (ctx, { name, ownerId, layoutId }) => {
    const screens = await screensWithPanels(ctx, layoutId);
    const config = {
      screens: screens.map((s) => ({
        name: s.name,
        width: s.width,
        height: s.height,
        panels: s.panels.map((p) => ({
          name: p.name,
          zIndex: p.zIndex,
          points: p.points,
        })),
      })),
    };
    return await ctx.db.insert("displayProfiles", {
      name,
      ownerId,
      config,
    });
  },
});

export const loadProfile = mutation({
  args: {
    profileId: v.id("displayProfiles"),
    layoutId: v.id("layouts"),
  },
  handler: async (ctx, { profileId, layoutId }) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) throw new Error("Profile not found");
    const config = profile.config as {
      screens: Array<{
        name: string;
        width: number;
        height: number;
        panels: Array<{
          name: string;
          zIndex: number;
          points: Array<{ x: number; y: number }>;
        }>;
      }>;
    };

    // Delete existing screens + panels for this layout.
    const existingScreens = await ctx.db
      .query("screens")
      .withIndex("by_layout", (q) => q.eq("layoutId", layoutId))
      .collect();
    for (const screen of existingScreens) {
      await deleteScreenCascade(ctx, screen._id);
    }

    // Create new screens + panels from the profile config.
    for (let i = 0; i < config.screens.length; i++) {
      const s = config.screens[i];
      const screenId = await ctx.db.insert("screens", {
        layoutId,
        name: s.name,
        order: i,
        width: s.width,
        height: s.height,
      });
      for (const p of s.panels) {
        await ctx.db.insert("panels", {
          screenId,
          name: p.name,
          zIndex: p.zIndex,
          points: p.points,
        });
      }
    }
  },
});

export const deleteProfile = mutation({
  args: { profileId: v.id("displayProfiles") },
  handler: async (ctx, { profileId }) => {
    await ctx.db.delete(profileId);
  },
});
