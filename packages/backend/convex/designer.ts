import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { KEY_FILL_LOGICALS } from "./rossRig";
import { inferScreenRole } from "./venueLogic";

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

/**
 * Flat list of physical screens for the /screens picker (grouped client-side
 * by layout). Optional ownerId limits to that operator's layouts.
 */
export const listScreens = query({
  args: { ownerId: v.optional(v.id("users")) },
  handler: async (ctx, { ownerId }) => {
    let layouts = await ctx.db.query("layouts").collect();
    if (ownerId) {
      layouts = layouts.filter((l) => l.ownerId === ownerId);
    }
    layouts.sort((a, b) => a.name.localeCompare(b.name));

    const result: Array<{
      _id: Id<"screens">;
      name: string;
      width: number;
      height: number;
      order: number;
      layoutId: Id<"layouts">;
      layoutName: string;
      role: "wall" | "table" | "phone" | "ticket";
    }> = [];

    for (const layout of layouts) {
      const screens = await ctx.db
        .query("screens")
        .withIndex("by_layout", (q) => q.eq("layoutId", layout._id))
        .collect();
      screens.sort((a, b) => a.order - b.order);
      for (const screen of screens) {
        result.push({
          _id: screen._id,
          name: screen.name,
          width: screen.width,
          height: screen.height,
          order: screen.order,
          layoutId: layout._id,
          layoutName: layout.name,
          role: screen.role ?? inferScreenRole(screen.name),
        });
      }
    }
    return result;
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

/** Catalog of logical panel slot names (legacy LogicalPanelType). */
export const LOGICAL_PANEL_TYPES = [
  "MainContent",
  "SecondaryContent",
  "Background",
  "Overlay",
  "Scoreboard",
  "Timer",
  "TeamA",
  "TeamB",
  "PlayerInfo",
  "Camera1",
  "Camera2",
  "Camera3",
  "LeftSidebar",
  "RightSidebar",
  "Header",
  "Footer",
  "Phone",
  ...KEY_FILL_LOGICALS,
] as const;

export const listLogicalPanelTypes = query({
  args: {},
  handler: async () => [...LOGICAL_PANEL_TYPES],
});

async function defaultProfileIdForShow(
  ctx: QueryCtx | MutationCtx,
  showId: Id<"shows">,
): Promise<Id<"displayProfiles"> | null> {
  const profiles = await ctx.db
    .query("displayProfiles")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  const def = profiles.find((p) => p.isDefault) ?? profiles[0];
  return def?._id ?? null;
}

async function mappingLookup(
  ctx: QueryCtx | MutationCtx,
  profileId: Id<"displayProfiles">,
): Promise<Map<string, Id<"panels">>> {
  const rows = await ctx.db
    .query("panelMappings")
    .withIndex("by_profile", (q) => q.eq("displayProfileId", profileId))
    .collect();
  return new Map(rows.map((m) => [m.logicalPanelName, m.panelId]));
}

/** Effects of a scene joined with their panel + screen names. */
export const getSceneEffects = query({
  args: {
    sceneId: v.id("scenes"),
    displayProfileId: v.optional(v.id("displayProfiles")),
  },
  handler: async (ctx, { sceneId, displayProfileId }) => {
    const effects = await ctx.db
      .query("effects")
      .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
      .collect();
    const mappings = displayProfileId
      ? await mappingLookup(ctx, displayProfileId)
      : null;
    const rows = [];
    for (const effect of effects) {
      const resolvedPanelId =
        (effect.logicalPanelName && mappings?.get(effect.logicalPanelName)) ||
        effect.panelId;
      const panel = resolvedPanelId ? await ctx.db.get(resolvedPanelId) : null;
      const screen = panel ? await ctx.db.get(panel.screenId) : null;
      rows.push({
        ...effect,
        panelId: resolvedPanelId,
        sourcePanelId: effect.panelId,
        panelName:
          effect.kind === "command"
            ? "Switcher"
            : effect.kind === "hotkey"
              ? "Hotkey"
              : effect.kind === "filter"
                ? "Filter"
            : (panel?.name ?? "(deleted panel)"),
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
 * Lightweight per-scene effects for scene-card cue thumbnails.
 * Keyed by sceneId so every card can render its own PanelStage preview.
 */
export const getShowCueEffects = query({
  args: {
    showId: v.id("shows"),
    displayProfileId: v.optional(v.id("displayProfiles")),
  },
  handler: async (ctx, { showId, displayProfileId }) => {
    const profileId =
      displayProfileId ?? (await defaultProfileIdForShow(ctx, showId));
    const mappings = profileId ? await mappingLookup(ctx, profileId) : null;
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", showId))
      .collect();
    const byScene: Record<
      string,
      Array<{
        panelId: Id<"panels">;
        kind: "image" | "video" | "color" | "text" | "url" | "html" | "camera";
        content: string;
        startTime: number;
        isEnabled: boolean;
        durationSec?: number;
        videoStartSec?: number;
      }>
    > = {};
    for (const scene of scenes) {
      const effects = await ctx.db
        .query("effects")
        .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
        .collect();
      const visual: Array<{
        panelId: Id<"panels">;
        kind: "image" | "video" | "color" | "text" | "url" | "html" | "camera";
        content: string;
        startTime: number;
        isEnabled: boolean;
        durationSec?: number;
        videoStartSec?: number;
      }> = [];
      for (const e of effects) {
        if (e.kind === "command" || e.kind === "hotkey" || e.kind === "filter")
          continue;
        const panelId =
          (e.logicalPanelName && mappings?.get(e.logicalPanelName)) || e.panelId;
        if (!panelId) continue;
        visual.push({
          panelId,
          kind: e.kind,
          content: e.content,
          startTime: e.startTime,
          isEnabled: e.isEnabled,
          durationSec: e.durationSec,
          videoStartSec: e.videoStartSec,
        });
      }
      byScene[scene._id] = visual;
    }
    return byScene;
  },
});

/**
 * Resolve which show + display profile a physical screen should follow.
 * Explicit ids win; otherwise auto-bind the first live show whose default
 * profile (or show.layoutId) targets this screen's layout.
 */
async function resolveScreenBinding(
  ctx: QueryCtx | MutationCtx,
  screen: Doc<"screens">,
  showId?: Id<"shows">,
  displayProfileId?: Id<"displayProfiles">,
): Promise<{
  show: Doc<"shows"> | null;
  profileId: Id<"displayProfiles"> | null;
  boundExplicitly: boolean;
}> {
  if (showId) {
    const show = await ctx.db.get(showId);
    if (!show) return { show: null, profileId: null, boundExplicitly: true };

    let profileId: Id<"displayProfiles"> | null = null;
    if (displayProfileId) {
      const profile = await ctx.db.get(displayProfileId);
      if (
        profile &&
        profile.showId === showId &&
        profile.layoutId === screen.layoutId
      ) {
        profileId = profile._id;
      }
    }
    if (!profileId) {
      const profiles = await ctx.db
        .query("displayProfiles")
        .withIndex("by_show", (q) => q.eq("showId", showId))
        .collect();
      const forLayout = profiles.filter((p) => p.layoutId === screen.layoutId);
      const pick =
        forLayout.find((p) => p.isDefault) ?? forLayout[0] ?? null;
      profileId = pick?._id ?? (await defaultProfileIdForShow(ctx, showId));
      // Reject a default that targets a different layout.
      if (profileId) {
        const p = await ctx.db.get(profileId);
        if (p && p.layoutId !== screen.layoutId) profileId = null;
      }
    }
    return { show, profileId, boundExplicitly: true };
  }

  const liveShows = await ctx.db
    .query("shows")
    .withIndex("by_status", (q) => q.eq("status", "live"))
    .collect();

  const matches: Doc<"shows">[] = [];
  for (const candidate of liveShows) {
    const pid = await defaultProfileIdForShow(ctx, candidate._id);
    if (pid) {
      const profile = await ctx.db.get(pid);
      if (profile?.layoutId === screen.layoutId) {
        matches.push(candidate);
        continue;
      }
    }
    if (candidate.layoutId === screen.layoutId) matches.push(candidate);
  }
  if (matches.length === 0) {
    return { show: null, profileId: null, boundExplicitly: false };
  }
  // Shared hardware (Battle + Wrestle on HyperX): follow the last cued show.
  matches.sort((a, b) => (b.sceneStartedAt ?? 0) - (a.sceneStartedAt ?? 0));
  const pick = matches[0]!;
  return {
    show: pick,
    profileId: await defaultProfileIdForShow(ctx, pick._id),
    boundExplicitly: false,
  };
}

/**
 * Everything one physical output (projector / LED wall) needs, in one
 * reactive query: the screen + its panels, the alignment state, and — if a
 * show targeting this screen's layout is live — the current scene and its
 * effects. This replaces the legacy SignalR DisplayHub messages: any change
 * (scene tap, panel nudge, alignment toggle) re-runs this query on the
 * screen page automatically.
 *
 * Optional showId / displayProfileId let the screen page pin a binding when
 * multiple shows share the same physical layout.
 */
export const screenView = query({
  args: {
    screenId: v.id("screens"),
    showId: v.optional(v.id("shows")),
    displayProfileId: v.optional(v.id("displayProfiles")),
  },
  handler: async (ctx, { screenId, showId, displayProfileId }) => {
    const screen = await ctx.db.get(screenId);
    if (!screen) return null;
    const panels = await ctx.db
      .query("panels")
      .withIndex("by_screen", (q) => q.eq("screenId", screenId))
      .collect();
    panels.sort((a, b) => a.zIndex - b.zIndex);
    const layout = await ctx.db.get(screen.layoutId);

    const { show, profileId, boundExplicitly } = await resolveScreenBinding(
      ctx,
      screen,
      showId,
      displayProfileId,
    );

    let scene: Doc<"scenes"> | null = null;
    let effects: Array<{
      panelId: Id<"panels">;
      kind: "image" | "video" | "color" | "text" | "url" | "html" | "camera";
      content: string;
      startTime: number;
      isEnabled: boolean;
      durationSec?: number;
      videoStartSec?: number;
    }> = [];
    // Explicitly bound shows still only render content while live.
    if (show && show.status === "live") {
      const scenes = await ctx.db
        .query("scenes")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      scenes.sort((a, b) => a.order - b.order);
      scene = scenes[show.currentSceneIndex] ?? null;
      if (scene) {
        const sceneId = scene._id;
        const mappings = profileId
          ? await mappingLookup(ctx, profileId)
          : null;
        const raw = await ctx.db
          .query("effects")
          .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
          .collect();
        for (const e of raw) {
          if (e.kind === "command" || e.kind === "hotkey" || e.kind === "filter")
            continue;
          const panelId =
            (e.logicalPanelName && mappings?.get(e.logicalPanelName)) ||
            e.panelId;
          if (!panelId) continue;
          effects.push({
            panelId,
            kind: e.kind,
            content: e.content,
            startTime: e.startTime,
            isEnabled: e.isEnabled,
            durationSec: e.durationSec,
            videoStartSec: e.videoStartSec,
          });
        }
      }
    }

    const warp = await warpForScreen(ctx, screenId);
    const asReference = await ctx.db
      .query("screenWarps")
      .withIndex("by_reference", (q) => q.eq("referenceScreenId", screenId))
      .collect();
    const refMarkers = asReference.find((w) => w.markersOn);
    const dualCalibRole: "p1" | "p2" | null = warp?.markersOn
      ? "p2"
      : refMarkers
        ? "p1"
        : null;

    return {
      screen: { ...screen, panels },
      layoutName: layout?.name ?? "",
      show,
      scene,
      effects,
      displayProfileId: profileId,
      boundExplicitly,
      dualCalibRole,
      warp:
        warp?.matrix && warp.matrix.length === 9
          ? {
              matrix: warp.matrix,
              referenceScreenId: warp.referenceScreenId,
              capturedAt: warp.capturedAt ?? null,
            }
          : null,
    };
  },
});

/**
 * Shows + display profiles that can drive a physical screen, plus the
 * operator's other screens (for jumping between projector tabs).
 */
export const screenBindingOptions = query({
  args: {
    screenId: v.id("screens"),
    ownerId: v.optional(v.id("users")),
  },
  handler: async (ctx, { screenId, ownerId }) => {
    const screen = await ctx.db.get(screenId);
    if (!screen) return null;
    const layout = await ctx.db.get(screen.layoutId);

    const shows = await ctx.db.query("shows").collect();
    const options = [];
    for (const show of shows) {
      const profiles = (
        await ctx.db
          .query("displayProfiles")
          .withIndex("by_show", (q) => q.eq("showId", show._id))
          .collect()
      ).filter((p) => p.layoutId === screen.layoutId);
      profiles.sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      const layoutMatch = show.layoutId === screen.layoutId;
      if (profiles.length === 0 && !layoutMatch) continue;
      options.push({
        showId: show._id,
        title: show.title,
        status: show.status,
        profiles: profiles.map((p) => ({
          _id: p._id,
          name: p.name,
          isDefault: p.isDefault,
        })),
      });
    }
    options.sort((a, b) => {
      const rank = { live: 0, draft: 1, ended: 2 } as const;
      const d = rank[a.status] - rank[b.status];
      if (d !== 0) return d;
      return a.title.localeCompare(b.title);
    });

    const myScreens: Array<{
      _id: Id<"screens">;
      name: string;
      layoutName: string;
    }> = [];
    if (ownerId) {
      const layouts = (await ctx.db.query("layouts").collect()).filter(
        (l) => l.ownerId === ownerId,
      );
      for (const l of layouts) {
        const screens = await ctx.db
          .query("screens")
          .withIndex("by_layout", (q) => q.eq("layoutId", l._id))
          .collect();
        screens.sort((a, b) => a.order - b.order);
        for (const s of screens) {
          myScreens.push({
            _id: s._id,
            name: s.name,
            layoutName: l.name,
          });
        }
      }
    }

    return {
      screenName: screen.name,
      layoutName: layout?.name ?? "",
      layoutId: screen.layoutId,
      shows: options,
      myScreens,
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

async function warpForScreen(ctx: QueryCtx | MutationCtx, screenId: Id<"screens">) {
  return await ctx.db
    .query("screenWarps")
    .withIndex("by_screen", (q) => q.eq("screenId", screenId))
    .first();
}

/** Show (or refresh) cyan/magenta corner markers on a dual-projector pair. */
export const setDualCalibMarkers = mutation({
  args: {
    p1ScreenId: v.id("screens"),
    p2ScreenId: v.id("screens"),
  },
  handler: async (ctx, { p1ScreenId, p2ScreenId }) => {
    if (p1ScreenId === p2ScreenId) {
      throw new Error("Pick two different screens for the cabinet");
    }
    const p1 = await ctx.db.get(p1ScreenId);
    const p2 = await ctx.db.get(p2ScreenId);
    if (!p1 || !p2) throw new Error("Screen not found");

    const all = await ctx.db.query("screenWarps").collect();
    for (const w of all) {
      if (w.markersOn && w.screenId !== p2ScreenId) {
        await ctx.db.patch(w._id, { markersOn: false });
      }
    }

    const existing = await warpForScreen(ctx, p2ScreenId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        referenceScreenId: p1ScreenId,
        markersOn: true,
      });
    } else {
      await ctx.db.insert("screenWarps", {
        screenId: p2ScreenId,
        referenceScreenId: p1ScreenId,
        markersOn: true,
      });
    }

    // Marker overlay replaces panel-align mode on both outputs.
    await ctx.db.patch(p1ScreenId, { alignPanelId: undefined });
    await ctx.db.patch(p2ScreenId, { alignPanelId: undefined });
  },
});

/** Hide corner markers without deleting a saved warp. */
export const clearDualCalibMarkers = mutation({
  args: { p2ScreenId: v.optional(v.id("screens")) },
  handler: async (ctx, { p2ScreenId }) => {
    if (p2ScreenId) {
      const w = await warpForScreen(ctx, p2ScreenId);
      if (w?.markersOn) await ctx.db.patch(w._id, { markersOn: false });
      return;
    }
    const all = await ctx.db.query("screenWarps").collect();
    for (const w of all) {
      if (w.markersOn) await ctx.db.patch(w._id, { markersOn: false });
    }
  },
});

/** Persist the P2→P1 homography and turn markers off. */
export const saveScreenWarp = mutation({
  args: {
    screenId: v.id("screens"),
    referenceScreenId: v.id("screens"),
    matrix: v.array(v.number()),
    imageWidth: v.optional(v.number()),
    imageHeight: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (
      args.matrix.length !== 9 ||
      args.matrix.some((n) => !Number.isFinite(n))
    ) {
      throw new Error("Warp matrix must be 9 finite numbers");
    }
    const existing = await warpForScreen(ctx, args.screenId);
    const fields = {
      referenceScreenId: args.referenceScreenId,
      matrix: args.matrix,
      capturedAt: Date.now(),
      imageWidth: args.imageWidth,
      imageHeight: args.imageHeight,
      markersOn: false,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("screenWarps", {
        screenId: args.screenId,
        ...fields,
      });
    }
  },
});

/** Delete a stored warp (and hide markers if they were on). */
export const clearScreenWarp = mutation({
  args: { screenId: v.id("screens") },
  handler: async (ctx, { screenId }) => {
    const w = await warpForScreen(ctx, screenId);
    if (w) await ctx.db.delete(w._id);
  },
});

export const getScreenWarp = query({
  args: { screenId: v.id("screens") },
  handler: async (ctx, { screenId }) => {
    return await warpForScreen(ctx, screenId);
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
    const profiles = await ctx.db
      .query("displayProfiles")
      .withIndex("by_show", (q) => q.eq("showId", showId))
      .collect();
    for (const profile of profiles) await deleteProfileCascade(ctx, profile._id);
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
    isOverlay: v.optional(v.boolean()),
    isSoundEffect: v.optional(v.boolean()),
  },
  handler: async (ctx, { showId, title, durationSec, isOverlay, isSoundEffect }) => {
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
      isOverlay,
      isSoundEffect,
    });
  },
});

export const updateScene = mutation({
  args: {
    sceneId: v.id("scenes"),
    title: v.optional(v.string()),
    durationSec: v.optional(v.number()),
    order: v.optional(v.number()),
    isOverlay: v.optional(v.boolean()),
    isSoundEffect: v.optional(v.boolean()),
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
    panelId: v.optional(v.id("panels")),
    logicalPanelName: v.optional(v.string()),
    kind: v.union(
      v.literal("image"),
      v.literal("video"),
      v.literal("color"),
      v.literal("text"),
      v.literal("url"),
      v.literal("html"),
      v.literal("command"),
      v.literal("hotkey"),
      v.literal("filter"),
      v.literal("camera"),
    ),
    content: v.string(),
    startTime: v.number(),
    durationSec: v.optional(v.number()),
    videoStartSec: v.optional(v.number()),
  },
  handler: async (
    ctx,
    {
      sceneId,
      panelId,
      logicalPanelName,
      kind,
      content,
      startTime,
      durationSec,
      videoStartSec,
    },
  ) => {
    return await ctx.db.insert("effects", {
      sceneId,
      kind,
      content,
      startTime,
      isEnabled: true,
      ...(panelId ? { panelId } : {}),
      ...(logicalPanelName ? { logicalPanelName } : {}),
      ...(durationSec !== undefined ? { durationSec } : {}),
      ...(videoStartSec !== undefined ? { videoStartSec } : {}),
    });
  },
});

export const updateEffect = mutation({
  args: {
    effectId: v.id("effects"),
    panelId: v.optional(v.id("panels")),
    logicalPanelName: v.optional(v.union(v.string(), v.null())),
    kind: v.optional(
      v.union(
        v.literal("image"),
        v.literal("video"),
        v.literal("color"),
        v.literal("text"),
        v.literal("url"),
        v.literal("html"),
        v.literal("command"),
        v.literal("hotkey"),
        v.literal("filter"),
        v.literal("camera"),
      ),
    ),
    content: v.optional(v.string()),
    startTime: v.optional(v.number()),
    isEnabled: v.optional(v.boolean()),
    durationSec: v.optional(v.number()),
    videoStartSec: v.optional(v.number()),
  },
  handler: async (ctx, { effectId, logicalPanelName, ...fields }) => {
    if (logicalPanelName === null) {
      const existing = await ctx.db.get(effectId);
      if (!existing) return;
      const nextPanelId = fields.panelId ?? existing.panelId;
      await ctx.db.replace(effectId, {
        sceneId: existing.sceneId,
        ...(nextPanelId ? { panelId: nextPanelId } : {}),
        kind: fields.kind ?? existing.kind,
        content: fields.content ?? existing.content,
        startTime: fields.startTime ?? existing.startTime,
        isEnabled: fields.isEnabled ?? existing.isEnabled,
        ...(fields.durationSec !== undefined
          ? { durationSec: fields.durationSec }
          : existing.durationSec !== undefined
            ? { durationSec: existing.durationSec }
            : {}),
        ...(fields.videoStartSec !== undefined
          ? { videoStartSec: fields.videoStartSec }
          : existing.videoStartSec !== undefined
            ? { videoStartSec: existing.videoStartSec }
            : {}),
        ...(existing.logicalPanelName
          ? { logicalPanelName: existing.logicalPanelName }
          : {}),
      });
      return;
    }
    await ctx.db.patch(effectId, {
      ...fields,
      ...(logicalPanelName !== undefined ? { logicalPanelName } : {}),
    });
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
  args: {
    layoutId: v.id("layouts"),
    name: v.string(),
    role: v.optional(
      v.union(
        v.literal("wall"),
        v.literal("table"),
        v.literal("phone"),
        v.literal("ticket"),
      ),
    ),
  },
  handler: async (ctx, { layoutId, name, role }) => {
    const screens = await ctx.db
      .query("screens")
      .withIndex("by_layout", (q) => q.eq("layoutId", layoutId))
      .collect();
    const portrait = (role ?? inferScreenRole(name)) === "phone";
    return await ctx.db.insert("screens", {
      layoutId,
      name,
      order: screens.length,
      width: portrait ? 390 : 800,
      height: portrait ? 844 : 600,
      role: role ?? inferScreenRole(name),
    });
  },
});

export const updateScreen = mutation({
  args: {
    screenId: v.id("screens"),
    name: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal("wall"),
        v.literal("table"),
        v.literal("phone"),
        v.literal("ticket"),
      ),
    ),
  },
  handler: async (ctx, { screenId, name, role }) => {
    const patch: { name?: string; role?: "wall" | "table" | "phone" | "ticket" } =
      {};
    if (name !== undefined) patch.name = name;
    if (role !== undefined) patch.role = role;
    await ctx.db.patch(screenId, patch);
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

async function clearDefaultProfiles(
  ctx: MutationCtx,
  showId: Id<"shows">,
  except?: Id<"displayProfiles">,
) {
  const profiles = await ctx.db
    .query("displayProfiles")
    .withIndex("by_show", (q) => q.eq("showId", showId))
    .collect();
  for (const profile of profiles) {
    if (profile.isDefault && profile._id !== except) {
      await ctx.db.patch(profile._id, { isDefault: false });
    }
  }
}

async function deleteProfileCascade(
  ctx: MutationCtx,
  profileId: Id<"displayProfiles">,
) {
  const mappings = await ctx.db
    .query("panelMappings")
    .withIndex("by_profile", (q) => q.eq("displayProfileId", profileId))
    .collect();
  for (const mapping of mappings) await ctx.db.delete(mapping._id);
  await ctx.db.delete(profileId);
}

/** Profiles for a show, default first. */
export const listShowProfiles = query({
  args: { showId: v.id("shows") },
  handler: async (ctx, { showId }) => {
    const profiles = await ctx.db
      .query("displayProfiles")
      .withIndex("by_show", (q) => q.eq("showId", showId))
      .collect();
    profiles.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    const rows = [];
    for (const profile of profiles) {
      const layout = await ctx.db.get(profile.layoutId);
      const mappingCount = (
        await ctx.db
          .query("panelMappings")
          .withIndex("by_profile", (q) => q.eq("displayProfileId", profile._id))
          .collect()
      ).length;
      rows.push({
        ...profile,
        layoutName: layout?.name ?? "(deleted layout)",
        mappingCount,
      });
    }
    return rows;
  },
});

/** Profile + mappings with panel/screen names for the mapping editor. */
export const getDisplayProfile = query({
  args: { profileId: v.id("displayProfiles") },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) return null;
    const layout = await ctx.db.get(profile.layoutId);
    const screens = layout
      ? await screensWithPanels(ctx, profile.layoutId)
      : [];
    const mappings = await ctx.db
      .query("panelMappings")
      .withIndex("by_profile", (q) => q.eq("displayProfileId", profileId))
      .collect();
    const mappingRows = [];
    for (const mapping of mappings) {
      const panel = await ctx.db.get(mapping.panelId);
      const screen = panel ? await ctx.db.get(panel.screenId) : null;
      mappingRows.push({
        ...mapping,
        panelName: panel?.name ?? "(deleted panel)",
        screenName: screen?.name ?? "",
      });
    }
    mappingRows.sort((a, b) =>
      a.logicalPanelName.localeCompare(b.logicalPanelName),
    );
    return {
      ...profile,
      layoutName: layout?.name ?? "(deleted layout)",
      screens,
      mappings: mappingRows,
    };
  },
});

export const createDisplayProfile = mutation({
  args: {
    showId: v.id("shows"),
    layoutId: v.id("layouts"),
    name: v.string(),
    description: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    ownerId: v.id("users"),
  },
  handler: async (
    ctx,
    { showId, layoutId, name, description, isDefault, ownerId },
  ) => {
    const makeDefault = isDefault ?? false;
    if (makeDefault) await clearDefaultProfiles(ctx, showId);
    const existing = await ctx.db
      .query("displayProfiles")
      .withIndex("by_show", (q) => q.eq("showId", showId))
      .collect();
    const profileId = await ctx.db.insert("displayProfiles", {
      name,
      description,
      showId,
      layoutId,
      isDefault: makeDefault || existing.length === 0,
      ownerId,
    });
    // Point the show at this profile's layout when it becomes the default.
    if (makeDefault || existing.length === 0) {
      await ctx.db.patch(showId, { layoutId });
    }
    return profileId;
  },
});

export const updateDisplayProfile = mutation({
  args: {
    profileId: v.id("displayProfiles"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    layoutId: v.optional(v.id("layouts")),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, { profileId, isDefault, layoutId, ...fields }) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) throw new Error("Profile not found");
    if (isDefault) await clearDefaultProfiles(ctx, profile.showId, profileId);
    const nextLayoutId = layoutId ?? profile.layoutId;
    await ctx.db.patch(profileId, {
      ...fields,
      ...(layoutId !== undefined ? { layoutId } : {}),
      ...(isDefault !== undefined ? { isDefault } : {}),
    });
    // Drop mappings whose panels are not on the new layout.
    if (layoutId !== undefined && layoutId !== profile.layoutId) {
      const screens = await screensWithPanels(ctx, layoutId);
      const valid = new Set(
        screens.flatMap((s) => s.panels.map((p) => p._id as string)),
      );
      const mappings = await ctx.db
        .query("panelMappings")
        .withIndex("by_profile", (q) => q.eq("displayProfileId", profileId))
        .collect();
      for (const mapping of mappings) {
        if (!valid.has(mapping.panelId)) await ctx.db.delete(mapping._id);
      }
    }
    if (isDefault || (profile.isDefault && layoutId !== undefined)) {
      await ctx.db.patch(profile.showId, { layoutId: nextLayoutId });
    }
  },
});

export const setDefaultDisplayProfile = mutation({
  args: { profileId: v.id("displayProfiles") },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) throw new Error("Profile not found");
    await clearDefaultProfiles(ctx, profile.showId, profileId);
    await ctx.db.patch(profileId, { isDefault: true });
    await ctx.db.patch(profile.showId, { layoutId: profile.layoutId });
  },
});

export const deleteDisplayProfile = mutation({
  args: { profileId: v.id("displayProfiles") },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) return;
    const wasDefault = profile.isDefault;
    const showId = profile.showId;
    await deleteProfileCascade(ctx, profileId);
    if (wasDefault) {
      const remaining = await ctx.db
        .query("displayProfiles")
        .withIndex("by_show", (q) => q.eq("showId", showId))
        .collect();
      if (remaining[0]) {
        await ctx.db.patch(remaining[0]._id, { isDefault: true });
        await ctx.db.patch(showId, { layoutId: remaining[0].layoutId });
      }
    }
  },
});

export const upsertPanelMapping = mutation({
  args: {
    displayProfileId: v.id("displayProfiles"),
    logicalPanelName: v.string(),
    panelId: v.id("panels"),
  },
  handler: async (ctx, { displayProfileId, logicalPanelName, panelId }) => {
    const existing = await ctx.db
      .query("panelMappings")
      .withIndex("by_profile_logical", (q) =>
        q
          .eq("displayProfileId", displayProfileId)
          .eq("logicalPanelName", logicalPanelName),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { panelId });
      return existing._id;
    }
    return await ctx.db.insert("panelMappings", {
      displayProfileId,
      logicalPanelName,
      panelId,
    });
  },
});

export const deletePanelMapping = mutation({
  args: { mappingId: v.id("panelMappings") },
  handler: async (ctx, { mappingId }) => {
    await ctx.db.delete(mappingId);
  },
});

/**
 * Heuristic: map each panel on the profile's layout to a logical slot.
 * Prefers known LogicalPanelType names; otherwise uses the panel name.
 */
export const autoMapByPanelName = mutation({
  args: { displayProfileId: v.id("displayProfiles") },
  handler: async (ctx, { displayProfileId }) => {
    const profile = await ctx.db.get(displayProfileId);
    if (!profile) throw new Error("Profile not found");
    const screens = await screensWithPanels(ctx, profile.layoutId);
    const panels = screens.flatMap((s) => s.panels);
    const typeSet = new Set<string>(
      LOGICAL_PANEL_TYPES.map((t) => t.toLowerCase()),
    );
    const aliases: Record<string, string> = {
      "garage door": "MainContent",
      "center spot": "MainContent",
      backdrop: "Background",
      "garage triangle": "Background",
      "column left": "LeftSidebar",
      "left wing": "LeftSidebar",
      "garage top left": "Header",
      "column right": "RightSidebar",
      "right wing": "RightSidebar",
      "garage top right": "Overlay",
      scoreboard: "Scoreboard",
      phone: "Phone",
      "audience phone": "Phone",
      "key fill: full overlay": "Key Fill: Full Overlay",
      "key fill: lower third": "Key Fill: Lower Third",
      "key fill: top corners": "Key Fill: Top Corners",
    };
    let count = 0;
    for (const panel of panels) {
      const key = panel.name.trim().toLowerCase();
      let logical = aliases[key];
      if (!logical) {
        const compact = panel.name.replace(/[\s_-]+/g, "");
        const match = [...typeSet].find(
          (t) => t === key || t === compact.toLowerCase(),
        );
        logical = match
          ? LOGICAL_PANEL_TYPES.find((t) => t.toLowerCase() === match)!
          : panel.name.trim();
      }
      const existing = await ctx.db
        .query("panelMappings")
        .withIndex("by_profile_logical", (q) =>
          q
            .eq("displayProfileId", displayProfileId)
            .eq("logicalPanelName", logical),
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { panelId: panel._id });
      } else {
        await ctx.db.insert("panelMappings", {
          displayProfileId,
          logicalPanelName: logical,
          panelId: panel._id,
        });
      }
      count++;
    }
    return count;
  },
});

/**
 * Persist resolved panel IDs onto effects for the show (non-destructive:
 * no panels/screens deleted). Useful when locking a profile into physical IDs.
 */
export const applyProfileToShowEffects = mutation({
  args: {
    showId: v.id("shows"),
    displayProfileId: v.id("displayProfiles"),
  },
  handler: async (ctx, { showId, displayProfileId }) => {
    const profile = await ctx.db.get(displayProfileId);
    if (!profile || profile.showId !== showId) {
      throw new Error("Profile not found for show");
    }
    const mappings = await mappingLookup(ctx, displayProfileId);
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_show", (q) => q.eq("showId", showId))
      .collect();
    let updated = 0;
    for (const scene of scenes) {
      const effects = await ctx.db
        .query("effects")
        .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
        .collect();
      for (const effect of effects) {
        if (!effect.logicalPanelName) continue;
        const mapped = mappings.get(effect.logicalPanelName);
        if (mapped && mapped !== effect.panelId) {
          await ctx.db.patch(effect._id, { panelId: mapped });
          updated++;
        }
      }
    }
    await ctx.db.patch(showId, { layoutId: profile.layoutId });
    return updated;
  },
});

