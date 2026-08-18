"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Doc, Id } from "@linkall/backend/convex/_generated/dataModel";
import { useCurrentUser } from "./current-user";
import { EmptyState, Loading } from "./empty-state";
import {
  getLocoBySlug,
  getLocoByTag,
  locoPaths,
  locoRoundTypes,
  rowTag,
  type LocoConfig,
} from "@linkall/backend/convex/locos";
import { PerformanceNightRows } from "./performance-nights";
import { DesignedSceneStage } from "./shows";

/**
 * Loco game-engine pages (Comedy Loco, Battle Loco, Wrestle Loco, HeadCase, LaffUp, This Game Show, Wedding Loco, Bar Loco, …).
 *
 * Routes live under `/locos/[slug]/{performances,performance,games}`. Comedy
 * Loco aliases at `/performances`, `/performance`, `/games` still work.
 */

type PerformanceView = NonNullable<FunctionReturnType<typeof api.game.get>>;
type Game = PerformanceView["games"][number];
type TabId = "shows" | "intros" | "scenes" | "game";

const TABS: { id: TabId; label: string }[] = [
  { id: "shows", label: "Shows" },
  { id: "intros", label: "Intros" },
  { id: "scenes", label: "Scenes" },
  { id: "game", label: "Game" },
];

function teamName(view: PerformanceView, teamIndex: 1 | 2) {
  return teamIndex === 1 ? view.team1 : view.team2;
}

/** Legacy UpdateRowStyles colors: lime winner, yellow playing, gray played. */
function rowClasses(game: Game) {
  if (game.isWinner) return "bg-lime-300 text-black font-semibold";
  if (game.isVoting) return "bg-amber-100 text-black";
  if (game.isPlaying) return "bg-yellow-300 text-black font-semibold";
  if (game.isPlayed) return "bg-gray-200 text-gray-600";
  return "bg-white text-gray-800";
}

// ---------------------------------------------------------------- list

/** Host's performances list for one loco. */
export function PerformanceList({ slug = "comedy-loco" }: { slug?: string }) {
  const loco = getLocoBySlug(slug);
  const paths = locoPaths(slug);
  const all = useQuery(api.game.list, {});
  const performances = all?.filter((p) => rowTag(p.tag) === loco?.tag);
  const { userId } = useCurrentUser();
  const [creating, setCreating] = useState(false);

  if (!loco) {
    return (
      <div className="p-6">
        <EmptyState
          title="Unknown loco"
          hint="That show format isn't in the registry yet."
        />
        <Link
          href={paths.hub}
          className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
        >
          ← Locos
        </Link>
      </div>
    );
  }

  if (performances === undefined) return <Loading />;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={paths.hub}
          className="text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-brand"
        >
          Locos
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {loco.name} performances
        </h1>
        {userId && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            New performance
          </button>
        )}
        <Link
          href={paths.games}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Games
        </Link>
        <Link
          href={paths.performance}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Open console
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-500">{loco.listHint}</p>

      {performances.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No performances yet"
            hint={`Add a performance to seed the ${loco.name} round grid, or seed the FunFirst database for a demo night.`}
          />
        </div>
      ) : (
        <div className="mt-6">
          <PerformanceNightRows performances={performances} slug={loco.slug} />
        </div>
      )}

      {creating && userId && (
        <CreatePerformanceModal
          loco={loco}
          ownerId={userId}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}

function CreatePerformanceModal({
  loco,
  ownerId,
  onClose,
}: {
  loco: LocoConfig;
  ownerId: Id<"users">;
  onClose: () => void;
}) {
  const create = useMutation(api.game.create);
  const shows = useQuery(api.shows.list, {});
  const [title, setTitle] = useState("");
  const [team1, setTeam1] = useState(loco.team1);
  const [team2, setTeam2] = useState(loco.team2);
  const [showId, setShowId] = useState<Id<"shows"> | "">("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await create({
        title,
        team1,
        team2,
        ownerId,
        tag: loco.tag,
        ...(showId ? { showId } : {}),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New performance" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Title">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Friday Night ${loco.name}`}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={loco.mode === "setlist" ? loco.team1 : "Team 1"}>
            <input
              className={inputCls}
              value={team1}
              onChange={(e) => setTeam1(e.target.value)}
            />
          </Field>
          <Field label={loco.mode === "setlist" ? loco.team2 : "Team 2"}>
            <input
              className={inputCls}
              value={team2}
              onChange={(e) => setTeam2(e.target.value)}
            />
          </Field>
        </div>
        {shows && shows.length > 0 && (
          <Field label="Designed show (optional)">
            <select
              className={inputCls}
              value={showId}
              onChange={(e) =>
                setShowId((e.target.value || "") as Id<"shows"> | "")
              }
            >
              <option value="">None — cue names only</option>
              {shows.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        <p className="text-xs text-gray-500">
          {loco.mode === "setlist"
            ? `Seeds the ${loco.templateRounds.length}-segment ${loco.name} set list. Assign segments from the console after you create it.`
            : `Seeds the ${loco.templateRounds.length}-round ${loco.name} grid for both teams. Pick games from the console after you create it.`}
          {showId
            ? " Game buttons play matching scenes from the bound show."
            : ""}
        </p>
        <button
          onClick={() => void save()}
          disabled={!title.trim() || saving}
          className="w-full rounded-md bg-brand py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create"}
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none";

/** Preselected type for the Add Round control. */
function defaultAddRoundType(loco: LocoConfig) {
  const types = locoRoundTypes(loco);
  if (loco.mode === "competition") {
    if (types.includes("Game")) return "Game";
    const scored = loco.templateRounds.find((r) => r.isScored)?.roundType;
    return scored ?? types[0] ?? "Game";
  }
  const counts = new Map<string, number>();
  for (const r of loco.templateRounds) {
    counts.set(r.roundType, (counts.get(r.roundType) ?? 0) + 1);
  }
  let best = loco.templateRounds.at(-1)?.roundType ?? types[0] ?? "";
  let bestCount = -1;
  for (const r of loco.templateRounds) {
    const n = counts.get(r.roundType) ?? 0;
    if (n >= bestCount) {
      bestCount = n;
      best = r.roundType;
    }
  }
  return best;
}

// ---------------------------------------------------------------- console

export function PerformanceConsole({
  slug = "comedy-loco",
  initialPerformanceId,
}: {
  slug?: string;
  initialPerformanceId?: Id<"performances"> | null;
} = {}) {
  const loco = getLocoBySlug(slug);
  const paths = locoPaths(slug);
  const all = useQuery(api.game.list, {});
  const performances = all?.filter((p) => rowTag(p.tag) === loco?.tag);
  const [selectedId, setSelectedId] = useState<Id<"performances"> | null>(
    initialPerformanceId ?? null,
  );
  const [tab, setTab] = useState<TabId>("game");

  useEffect(() => {
    if (initialPerformanceId) setSelectedId(initialPerformanceId);
  }, [initialPerformanceId]);

  const performance =
    performances?.find((p) => p._id === selectedId) ?? performances?.[0] ?? null;
  const view = useQuery(
    api.game.get,
    performance ? { performanceId: performance._id } : "skip",
  );
  const shows = useQuery(api.shows.list, {});

  if (!loco) {
    return (
      <div className="p-6">
        <EmptyState
          title="Unknown loco"
          hint="That show format isn't in the registry yet."
        />
        <Link
          href={paths.hub}
          className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
        >
          ← Locos
        </Link>
      </div>
    );
  }

  if (performances === undefined) return <Loading />;
  if (performances.length === 0)
    return (
      <div className="p-6">
        <EmptyState
          title="No performances yet"
          hint={`Seed the FunFirst database, or open ${loco.name} performances after data is loaded.`}
        />
        <Link
          href={paths.performances}
          className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
        >
          ← {loco.name} performances
        </Link>
      </div>
    );

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-lg flex-col pb-28">
      {/* Header + performance picker */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={paths.performances}
            className="shrink-0 text-xs font-semibold text-gray-400 hover:text-brand"
            title={`All ${loco.name} performances`}
          >
            ←
          </Link>
          <h1 className="text-lg font-bold text-gray-900">{loco.name}</h1>
        </div>
        <select
          className="max-w-[55%] truncate rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-medium"
          value={performance?._id ?? ""}
          onChange={(e) => setSelectedId(e.target.value as Id<"performances">)}
        >
          {performances.map((p) => (
            <option key={p._id} value={p._id}>
              {p.title}
              {p.status === "live" ? " — LIVE" : ""}
            </option>
          ))}
        </select>
      </div>

      {view === undefined || view === null ? (
        <Loading />
      ) : (
        <Console
          view={view}
          tab={tab}
          shows={shows ?? []}
          tag={loco.tag}
          setlist={loco.mode === "setlist"}
          screenHref={paths.screen(view._id)}
          previewHref={paths.preview(view._id)}
        />
      )}

      {/* Bottom tab bar (legacy nav-tabs-container) */}
      <nav className="fixed bottom-16 left-0 right-0 z-40 border-t border-gray-200 bg-gray-50 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
        <ul className="mx-auto flex max-w-lg">
          {TABS.map((t) => (
            <li key={t.id} className="flex-1">
              <button
                onClick={() => setTab(t.id)}
                className={
                  "block w-full border-t-[3px] py-3 text-center text-sm font-bold transition " +
                  (tab === t.id
                    ? "border-brand bg-white text-brand"
                    : "border-transparent text-gray-500 hover:bg-gray-100")
                }
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function Console({
  view,
  tab,
  shows,
  tag,
  setlist,
  screenHref,
  previewHref,
}: {
  view: PerformanceView;
  tab: TabId;
  shows: Doc<"shows">[];
  tag: string;
  setlist: boolean;
  screenHref: string;
  previewHref: string;
}) {
  const setOverlay = useMutation(api.game.setOverlay);
  const setShow = useMutation(api.game.setShow);
  const playPerformanceScene = useMutation(api.game.playPerformanceScene);
  const reset = useMutation(api.game.reset);
  const bellBonus = useMutation(api.game.bellBonus);

  const performanceId = view._id;
  const screenUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${screenHref}`
      : "";
  const boundShowId = view.showId ?? view.show?._id;
  const liveIndex =
    view.show?.status === "live" ? view.show.currentSceneIndex : -1;

  const cueScene = (sceneId: Id<"scenes">) =>
    playPerformanceScene({ performanceId, sceneId });

  if (tab === "shows") {
    return (
      <div className="flex-1 overflow-y-auto p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Designed show
        </p>
        <select
          className="mb-3 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium"
          value={boundShowId ?? ""}
          onChange={(e) =>
            void setShow({
              performanceId,
              showId: e.target.value
                ? (e.target.value as Id<"shows">)
                : undefined,
            })
          }
        >
          <option value="">None — overlays stay text-only</option>
          {shows.map((s) => (
            <option key={s._id} value={s._id}>
              {s.title}
              {s.status === "live" ? " — LIVE" : ""}
            </option>
          ))}
        </select>
        {view.show && (
          <p className="mb-2 text-xs text-gray-500">
            Game buttons play scenes from{" "}
            <span className="font-semibold text-gray-700">{view.show.title}</span>{" "}
            whose names match the cue (Game Instructions, Vote, Winner…).
          </p>
        )}
        {(view.scenes ?? []).length === 0 ? (
          <p className="mb-3 text-xs text-gray-400">
            {boundShowId
              ? "This show has no scenes yet — add them in the Designer."
              : "Bind a show to load its designed scenes onto this board."}
          </p>
        ) : (
          <div className="mb-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
            {(view.scenes ?? []).map((s) => {
              const live = s.index === liveIndex;
              const active = view.activeSceneId === s._id;
              return (
                <button
                  key={s._id}
                  onClick={() => void cueScene(s._id)}
                  className={
                    "flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2.5 text-left text-sm last:border-b-0 " +
                    (live || active
                      ? "bg-red-50 font-semibold text-red-700"
                      : "hover:bg-gray-50")
                  }
                >
                  <span className="w-5 text-gray-400">{s.index + 1}</span>
                  <span className="flex-1 truncate">{s.title}</span>
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    {s.bucket}
                  </span>
                  {live && <span className="text-xs">● LIVE</span>}
                </button>
              );
            })}
          </div>
        )}
        <ScreenLinks
          screenUrl={screenUrl}
          screenHref={screenHref}
          previewHref={previewHref}
          performanceId={performanceId}
          reset={reset}
        />
      </div>
    );
  }

  if (tab === "intros") {
    const introScenes = view.sceneBuckets?.intro ?? [];
    return (
      <div className="flex-1 overflow-y-auto p-3">
        {introScenes.length > 0 && (
          <>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Intro scenes
            </p>
            {introScenes.map((s) => (
              <button
                key={s._id}
                onClick={() => void cueScene(s._id)}
                className={
                  "mb-2 block w-full rounded-lg border px-3 py-3 text-left text-sm font-semibold " +
                  (view.activeSceneId === s._id
                    ? "border-brand bg-brand-light text-brand-dark"
                    : "border-gray-200 bg-white hover:bg-gray-50")
                }
              >
                {s.title}
              </button>
            ))}
          </>
        )}
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Performer intros
        </p>
        {view.performers.map((p) => {
          const label = `Introduction: ${p.name}`;
          const active = view.activeOverlay === label;
          return (
            <button
              key={p._id}
              onClick={() => setOverlay({ performanceId, overlay: label })}
              className={
                "mb-2 flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm " +
                (active
                  ? "border-brand bg-brand-light font-semibold"
                  : "border-gray-200 bg-white hover:bg-gray-50")
              }
            >
              <span className="flex-1 font-semibold">{p.name}</span>
              <span className="text-xs text-gray-400">{teamName(view, p.teamIndex)}</span>
            </button>
          );
        })}
        <ScreenLinks
          screenUrl={screenUrl}
          screenHref={screenHref}
          previewHref={previewHref}
          performanceId={performanceId}
          reset={reset}
        />
      </div>
    );
  }

  if (tab === "scenes") {
    return (
      <div className="flex-1 overflow-y-auto p-3">
        <SceneBuckets view={view} performanceId={performanceId} />
        <ScreenLinks
          screenUrl={screenUrl}
          screenHref={screenHref}
          previewHref={previewHref}
          performanceId={performanceId}
          reset={reset}
        />
      </div>
    );
  }

  // Game tab — matches legacy tabGame layout
  return (
    <div className="flex-1 space-y-0 overflow-y-auto">
      <GameGrid view={view} tag={tag} setlist={setlist} />
      <PerformerBar view={view} bellBonus={bellBonus} />
      <OverlayTrackColumns view={view} performanceId={performanceId} />
      <ControlStrip view={view} setlist={setlist} />
      <div className="p-3">
        <ScreenLinks
          screenUrl={screenUrl}
          screenHref={screenHref}
          previewHref={previewHref}
          performanceId={performanceId}
          reset={reset}
        />
      </div>
    </div>
  );
}

function PerformerBar({
  view,
  bellBonus,
}: {
  view: PerformanceView;
  bellBonus: ReturnType<typeof useMutation<typeof api.game.bellBonus>>;
}) {
  const lead = view.performers[0];
  return (
    <div className="flex items-center gap-2 border-y border-gray-800 bg-gray-900 px-3 py-2 text-white">
      <span className="text-sm font-semibold">Performer</span>
      <span className="flex-1 truncate text-sm font-bold text-amber-300">
        {lead?.name ?? "—"}
      </span>
      {lead && (
        <button
          onClick={() => bellBonus({ performerId: lead._id, points: 1 })}
          className="rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950"
          title="Bell bonus"
        >
          🔔
        </button>
      )}
      <span className="text-lg font-light text-gray-400">+</span>
    </div>
  );
}

function SceneCueRow({
  label,
  active,
  live,
  onClick,
}: {
  label: string;
  active: boolean;
  live?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "block w-full truncate border-b border-gray-100 px-2 py-2 text-left text-xs " +
        (active || live
          ? "bg-brand-light font-semibold text-brand-dark"
          : "hover:bg-gray-50")
      }
    >
      {live ? "● " : ""}
      {label}
    </button>
  );
}

function SceneBuckets({
  view,
  performanceId,
}: {
  view: PerformanceView;
  performanceId: Id<"performances">;
}) {
  const buckets = view.sceneBuckets;
  const hasDesigned =
    buckets &&
    (buckets.overlay.length ||
      buckets.background.length ||
      buckets.music.length ||
      buckets.sound.length);
  if (!hasDesigned) {
    return <OverlayTrackColumns view={view} performanceId={performanceId} />;
  }
  const liveIndex =
    view.show?.status === "live" ? view.show.currentSceneIndex : -1;
  const playScene = useMutation(api.game.playPerformanceScene);
  const cue = (sceneId: Id<"scenes">) =>
    playScene({ performanceId, sceneId });
  const cols: { title: string; rows: typeof buckets.overlay }[] = [
    { title: "Backgrounds", rows: buckets.background },
    { title: "Overlays", rows: buckets.overlay },
    { title: "Music", rows: buckets.music },
    { title: "Sounds", rows: buckets.sound },
  ];
  return (
    <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-lg border border-gray-200">
      {cols.map((col) => (
        <div
          key={col.title}
          className="border-b border-r border-gray-200 bg-white last:border-r-0"
        >
          <div className="bg-gray-900 px-2 py-1.5 text-xs font-semibold uppercase text-white">
            {col.title}
          </div>
          {col.rows.length === 0 ? (
            <p className="px-2 py-3 text-[11px] text-gray-400">None designed</p>
          ) : (
            col.rows.map((s) => (
              <SceneCueRow
                key={s._id}
                label={s.title}
                active={view.activeSceneId === s._id}
                live={s.index === liveIndex}
                onClick={() => void cue(s._id)}
              />
            ))
          )}
        </div>
      ))}
    </div>
  );
}

function OverlayTrackColumns({
  view,
  performanceId,
}: {
  view: PerformanceView;
  performanceId: Id<"performances">;
}) {
  const setOverlay = useMutation(api.game.setOverlay);
  const setTrack = useMutation(api.game.setTrack);
  const playScene = useMutation(api.game.playPerformanceScene);
  const overlayScenes = view.sceneBuckets?.overlay ?? [];
  const musicScenes = view.sceneBuckets?.music ?? [];
  const liveIndex =
    view.show?.status === "live" ? view.show.currentSceneIndex : -1;

  const overlayRows =
    overlayScenes.length > 0
      ? overlayScenes.map((s) => ({
          key: s._id,
          name: s.title,
          active:
            view.activeSceneId === s._id || view.activeOverlay === s.title,
          live: s.index === liveIndex,
          onClick: () => void playScene({ performanceId, sceneId: s._id }),
        }))
      : view.overlays.map((o) => ({
          key: o._id,
          name: o.name,
          active: view.activeOverlay === o.name,
          live: false,
          onClick: () =>
            setOverlay({
              performanceId,
              overlay: view.activeOverlay === o.name ? undefined : o.name,
            }),
        }));

  const trackRows =
    musicScenes.length > 0
      ? musicScenes.map((s) => ({
          key: s._id,
          name: s.title,
          active: view.activeTrack === s.title,
          onClick: () => void playScene({ performanceId, sceneId: s._id }),
        }))
      : view.tracks.map((t) => ({
          key: t._id,
          name: t.name,
          active: view.activeTrack === t.name,
          onClick: () =>
            setTrack({
              performanceId,
              track: view.activeTrack === t.name ? undefined : t.name,
            }),
        }));

  return (
    <div className="grid grid-cols-2 gap-0 border-b border-gray-200">
      <div className="border-r border-gray-200 bg-white">
        <div className="bg-gray-900 px-2 py-1.5 text-xs font-semibold uppercase text-white">
          Overlay
        </div>
        {overlayRows.map((row) => (
          <SceneCueRow
            key={row.key}
            label={row.name}
            active={row.active}
            live={row.live}
            onClick={row.onClick}
          />
        ))}
      </div>
      <div className="bg-white">
        <div className="bg-gray-900 px-2 py-1.5 text-xs font-semibold uppercase text-white">
          Track
        </div>
        {trackRows.map((row) => (
          <SceneCueRow
            key={row.key}
            label={(row.active ? "♪ " : "") + row.name}
            active={row.active}
            onClick={row.onClick}
          />
        ))}
      </div>
    </div>
  );
}

function ScreenLinks({
  screenUrl,
  screenHref,
  previewHref,
  performanceId,
  reset,
}: {
  screenUrl: string;
  screenHref: string;
  previewHref: string;
  performanceId: Id<"performances">;
  reset: ReturnType<typeof useMutation<typeof api.game.reset>>;
}) {
  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        onClick={() => navigator.clipboard.writeText(screenUrl)}
        className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-2 text-xs font-semibold hover:bg-gray-50"
      >
        Copy screen URL
      </button>
      <a
        href={previewHref}
        target="_blank"
        className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-2 text-center text-xs font-semibold hover:bg-gray-50"
      >
        Preview all screens
      </a>
      <a
        href={screenHref}
        target="_blank"
        className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-2 text-center text-xs font-semibold hover:bg-gray-50"
      >
        Open screen
      </a>
      <button
        onClick={() => reset({ performanceId })}
        className="rounded-md border border-red-200 bg-red-50 px-2 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
      >
        Reset
      </button>
    </div>
  );
}

// --------------------------------------------------------------- game grid

function GameGrid({
  view,
  tag,
  setlist,
}: {
  view: PerformanceView;
  tag: string;
  setlist: boolean;
}) {
  const assignGame = useMutation(api.game.assignGame);
  const addRound = useMutation(api.game.addRound);
  const deleteRound = useMutation(api.game.deleteRound);
  const loco = getLocoByTag(tag);
  const roundTypes = loco ? locoRoundTypes(loco) : [];
  const [addType, setAddType] = useState(() =>
    loco ? defaultAddRoundType(loco) : "",
  );
  const catalog =
    (useQuery(api.game.listCatalog, {}) ?? []).filter(
      (c) => rowTag(c.tag) === tag,
    );

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-xs">
          <thead>
            <tr className="bg-gray-900 text-left uppercase tracking-wide text-white">
              <th className="px-1.5 py-1.5">#</th>
              <th className="px-1.5 py-1.5">Type</th>
              <th className="px-1.5 py-1.5">{setlist ? "Cast" : "Team"}</th>
              <th className="px-1.5 py-1.5">{setlist ? "Segment" : "Game"}</th>
              {!setlist && (
                <>
                  <th className="px-1.5 py-1.5 text-right">V</th>
                  <th className="px-1.5 py-1.5 text-right">S</th>
                </>
              )}
              <th className="w-7 px-1 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {view.games.map((g) => {
              const isCurrent =
                view.current !== null &&
                (g._id === view.current.game1Id || g._id === view.current.game2Id);
              const firstOfRound = g.teamIndex === 1;
              const roundActive = view.games.some(
                (row) =>
                  row.round === g.round &&
                  (row.isPlaying || row.isCued || row.isVoting),
              );
              return (
                <tr
                  key={g._id}
                  className={
                    rowClasses(g) +
                    " border-b border-gray-100" +
                    (isCurrent ? " ring-2 ring-inset ring-brand" : "")
                  }
                >
                  <td className="px-1.5 py-1.5">{g.round}</td>
                  <td className="px-1.5 py-1.5">{g.roundType}</td>
                  <td className="max-w-[4rem] truncate px-1.5 py-1.5">
                    {teamName(view, g.teamIndex)}
                  </td>
                  <td className="px-1.5 py-1.5">
                    <select
                      className="w-full min-w-[6rem] bg-transparent px-0.5 outline-none focus:bg-white/80"
                      value={g.gameId ?? ""}
                      onChange={(e) => {
                        const catalogId = e.target.value
                          ? (e.target.value as Id<"comedyGames">)
                          : undefined;
                        void assignGame({
                          gameRowId: g._id,
                          catalogId,
                          gameName: "",
                        });
                      }}
                    >
                      <option value="">{g.gameName || "game…"}</option>
                      {(catalog.filter(
                        (c) =>
                          c.roundType.toLowerCase() === g.roundType.toLowerCase() ||
                          g.roundType.toLowerCase().startsWith(
                            c.roundType.toLowerCase().slice(0, 4),
                          ),
                      ).length
                        ? catalog.filter(
                            (c) =>
                              c.roundType.toLowerCase() === g.roundType.toLowerCase() ||
                              g.roundType.toLowerCase().startsWith(
                                c.roundType.toLowerCase().slice(0, 4),
                              ),
                          )
                        : catalog
                      ).map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  {!setlist && (
                    <>
                      <td className="px-1.5 py-1.5 text-right">
                        {g.roundType.toLowerCase().includes("volunteer")
                          ? (g.volunteers ?? 0)
                          : g.votes}
                      </td>
                      <td className="px-1.5 py-1.5 text-right">
                        {g.score}
                        {g.rotation ? " ↻" : ""}
                      </td>
                    </>
                  )}
                  <td className="px-1 py-1.5 text-center">
                    {firstOfRound && (
                      <button
                        type="button"
                        disabled={roundActive}
                        title={roundActive ? "Round is active" : "Delete round"}
                        aria-label={
                          roundActive ? "Round is active" : "Delete round"
                        }
                        onClick={() =>
                          void deleteRound({
                            performanceId: view._id,
                            round: g.round,
                          })
                        }
                        className="rounded px-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-2 py-2">
        {roundTypes.length > 1 && (
          <select
            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
            value={addType}
            onChange={(e) => setAddType(e.target.value)}
            aria-label="Round type"
          >
            {roundTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          disabled={!addType}
          onClick={() =>
            void addRound({
              performanceId: view._id,
              roundType: addType,
            })
          }
          className="shrink-0 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Add Round
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ control strip

/**
 * Legacy Show.cshtml button strip from game-1.0.1.js GetCurrentGameRow:
 *   idle/cued → Begin Game
 *   team 1 (different games) → Next Game
 *   team 2 / same-game both playing → End Round (+ Rotation if same game)
 *   voting → Win 1 / Win 2
 * Next is the unified advance (Begin / Next Game / End Round).
 *
 * Set list: hide scoreboard, votes, Win/Rotation. Buttons read Begin Segment
 * / End Segment; Next is the step-through control.
 */
function ControlStrip({
  view,
  setlist,
}: {
  view: PerformanceView;
  setlist: boolean;
}) {
  const beginGame = useMutation(api.game.beginGame);
  const nextGame = useMutation(api.game.nextGame);
  const endRound = useMutation(api.game.endRound);
  const next = useMutation(api.game.next);
  const winGame = useMutation(api.game.winGame);
  const winRotation = useMutation(api.game.winRotation);
  const addVolunteers = useMutation(api.game.addVolunteers);

  const performanceId = view._id;
  const current = view.current;

  const btn =
    "flex-1 rounded-md px-3 py-3 text-sm font-bold shadow-sm transition active:scale-95";

  if (!current)
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 text-center text-sm font-semibold text-gray-500">
        Show complete — reset to run it again.
      </div>
    );

  const game1 = view.games.find((g) => g._id === current.game1Id)!;
  const game2 = view.games.find((g) => g._id === current.game2Id)!;
  const playing = current.phase === "team2" ? game2 : game1;
  const catalog = view.catalog;
  const phase = current.phase;
  const showBegin = phase === "idle" || phase === "cued";
  const showNextGame = !setlist && phase === "team1";
  const showEndRound =
    setlist ? phase === "team1" : phase === "team2" || phase === "both";
  const showWin = !setlist && phase === "voting";
  const showRotation =
    !setlist && current.sameGame && (phase === "both" || phase === "team2");
  const showNext = !showWin;

  return (
    <div className="border-t border-gray-200 bg-white p-2">
      {!setlist && (
        <div className="mb-2 grid grid-cols-2 gap-1">
          {([1, 2] as const).map((t) => (
            <div key={t} className="rounded border border-gray-200 px-2 py-1 text-center">
              <p className="text-[10px] font-semibold uppercase text-gray-400">
                {teamName(view, t)}
              </p>
              <p className="text-xl font-black text-brand-dark">
                {t === 1 ? view.scores.team1 : view.scores.team2}
              </p>
            </div>
          ))}
        </div>
      )}
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {setlist ? "Segment" : "Round"} {game1.round} · {game1.roundType}
        {playing.gameName ? ` · ${playing.gameName}` : ""}
        {current.sameGame ? " · same game" : ""}
      </p>
      {catalog && (catalog.description || catalog.suggestions) && (
        <p className="mb-2 text-xs text-gray-600">
          {catalog.description}
          {catalog.suggestions ? (
            <span className="mt-0.5 block text-gray-400">
              Ask: {catalog.suggestions}
            </span>
          ) : null}
        </p>
      )}

      {!setlist && current.volunteerRound && !showBegin && !showWin && (
        <div className="mb-2 flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
          <span className="text-xs font-semibold text-amber-900">Volunteers</span>
          {([1, 2] as const).map((t) => {
            const row = t === 1 ? game1 : game2;
            return (
              <div key={t} className="flex flex-1 items-center justify-center gap-1">
                <button
                  onClick={() =>
                    addVolunteers({ performanceId, teamIndex: t, delta: -1 })
                  }
                  className="h-7 w-7 rounded bg-white text-sm font-bold shadow-sm"
                >
                  −
                </button>
                <span className="min-w-[3.5rem] text-center text-xs font-semibold">
                  {teamName(view, t)} {row.volunteers ?? 0}
                </span>
                <button
                  onClick={() =>
                    addVolunteers({ performanceId, teamIndex: t, delta: 1 })
                  }
                  className="h-7 w-7 rounded bg-white text-sm font-bold shadow-sm"
                >
                  +
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {showBegin && (
          <button
            onClick={() => beginGame({ performanceId })}
            className={btn + " bg-brand text-white hover:opacity-90"}
          >
            {setlist ? "Begin Segment" : "Begin Game"}
          </button>
        )}
        {showNextGame && (
          <button
            onClick={() => nextGame({ performanceId })}
            className={btn + " bg-brand text-white hover:opacity-90"}
          >
            Next Game
          </button>
        )}
        {showEndRound && (
          <button
            onClick={() => endRound({ performanceId })}
            className={btn + " bg-brand text-white hover:opacity-90"}
          >
            {setlist ? "End Segment" : "End Round"}
          </button>
        )}
        {showRotation && (
          <>
            <button
              onClick={() => winRotation({ performanceId, teamIndex: 1 })}
              className={btn + " bg-gray-100 text-gray-700 hover:bg-gray-200"}
            >
              Rotation {view.team1}
            </button>
            <button
              onClick={() => winRotation({ performanceId, teamIndex: 2 })}
              className={btn + " bg-gray-100 text-gray-700 hover:bg-gray-200"}
            >
              Rotation {view.team2}
            </button>
          </>
        )}
        {showWin && (
          <>
            <button
              onClick={() => winGame({ performanceId, teamIndex: 1 })}
              className={btn + " bg-yellow-400 text-yellow-950 hover:bg-yellow-300"}
            >
              Win {view.team1}
            </button>
            <button
              onClick={() => winGame({ performanceId, teamIndex: 2 })}
              className={btn + " bg-pink-500 text-white hover:bg-pink-400"}
            >
              Win {view.team2}
            </button>
          </>
        )}
      </div>
      {showNext && (
        <button
          onClick={() => next({ performanceId })}
          className="mt-1 w-full rounded-md border border-brand bg-brand-light px-3 py-2 text-sm font-bold text-brand-dark hover:opacity-90"
        >
          {setlist ? "Next Segment" : "Next"}
        </button>
      )}
    </div>
  );
}

// -------------------------------------------------------------- screen page

/** Chrome-less iframe target for URL effects (legacy Score / Vote / GameInstruction pages). */
export function PerformanceOverlay({
  performanceId,
  kind,
}: {
  performanceId: Id<"performances">;
  kind: string;
}) {
  const view = useQuery(api.game.get, { performanceId });
  if (view === undefined) return <div className="fixed inset-0 bg-black" />;
  if (view === null)
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-gray-500">
        Performance not found.
      </div>
    );
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <OverlayView view={view} forceKind={kind} />
    </div>
  );
}

/** Fullscreen venue display: designed live scene, else the overlay HUD. */
export function PerformanceScreen({
  performanceId,
}: {
  performanceId: Id<"performances">;
}) {
  const view = useQuery(api.game.get, { performanceId });

  if (view === undefined)
    return <div className="fixed inset-0 z-50 bg-black" />;
  if (view === null)
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-gray-500">
        Performance not found.
      </div>
    );

  const liveScene =
    view.show?.status === "live" && view.scenes
      ? (view.scenes[view.show.currentSceneIndex] ?? null)
      : null;
  const designed =
    liveScene && view.show
      ? liveScene.kind === "panels" ||
        liveScene.kind === "image" ||
        liveScene.kind === "text" ||
        liveScene.kind === "title" ||
        liveScene.kind === "score"
      : false;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      {designed && liveScene && view.show ? (
        <>
          <div className="absolute inset-0">
            <DesignedSceneStage show={view.show} scene={liveScene} />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 pb-8 pt-16">
            <OverlayView view={view} compact />
          </div>
        </>
      ) : (
        <OverlayView view={view} />
      )}
      {view.activeTrack && (
        <div className="absolute bottom-4 right-6 text-sm text-white/40">
          ♪ {view.activeTrack}
        </div>
      )}
    </div>
  );
}

const OVERLAY_KIND_TO_CUE: Record<string, string> = {
  instructions: "game instructions",
  "game-instructions": "game instructions",
  vote: "vote",
  score: "score",
  "box-score": "box score",
  rotation: "score rotation",
  "score-rotation": "score rotation",
  winner: "winner",
  games: "games",
  introduction: "introduction",
  suggestions: "suggestions",
  crowd: "crowd",
  punishment: "punishment",
  ring: "ring",
};

function OverlayView({
  view,
  compact = false,
  forceKind,
}: {
  view: PerformanceView;
  compact?: boolean;
  forceKind?: string;
}) {
  const overlay = (
    (forceKind && OVERLAY_KIND_TO_CUE[forceKind]) ||
    view.activeOverlay ||
    ""
  ).toLowerCase();
  const titleCls = compact ? "text-4xl font-black" : "text-7xl font-black";
  const subCls = compact
    ? "text-lg font-semibold uppercase tracking-widest text-white/60"
    : "text-3xl font-semibold uppercase tracking-widest text-white/50";
  const current = view.current;
  const game1 = current ? view.games.find((g) => g._id === current.game1Id) : null;
  const game2 = current ? view.games.find((g) => g._id === current.game2Id) : null;
  const playing = game2?.isPlaying ? game2 : game1?.isPlaying ? game1 : null;

  if (overlay.startsWith("introduction:"))
    return (
      <div className="px-8 text-center">
        <p className={subCls}>Introducing</p>
        <h1 className={"mt-4 text-amber-400 " + titleCls}>
          {view.activeOverlay!.replace(/^introduction:\s*/i, "")}
        </h1>
      </div>
    );

  if (overlay === "game instructions" && game1)
    return (
      <div className="px-8 text-center">
        <p className={subCls}>
          Round {game1.round} · {game1.roundType}
        </p>
        <h1 className={"mt-4 " + titleCls}>
          {(playing ?? game1).gameName}
        </h1>
        {playing && (
          <p className="mt-6 text-4xl font-bold text-amber-400">
            Now playing: {teamName(view, playing.teamIndex)}
          </p>
        )}
      </div>
    );

  if (overlay === "vote" && view.mode !== "setlist")
    return (
      <div className="px-8 text-center">
        <h1 className={"text-amber-400 " + (compact ? "text-5xl font-black" : "text-8xl font-black")}>
          VOTE!
        </h1>
        <div className="mt-10 flex items-center justify-center gap-12 text-5xl font-black">
          <span className="text-yellow-300">{view.team1}</span>
          <span className="text-2xl text-white/40">vs</span>
          <span className="text-pink-400">{view.team2}</span>
        </div>
        <p className="mt-8 text-2xl text-white/60">Cheer for your team!</p>
      </div>
    );

  if (overlay.startsWith("winner") && view.mode !== "setlist")
    return (
      <div className="px-8 text-center">
        <p className="text-3xl font-semibold uppercase tracking-widest text-white/50">
          Round winner
        </p>
        <h1
          className={
            "mt-4 animate-bounce text-lime-400 " +
            (compact ? "text-5xl font-black" : "text-8xl font-black")
          }
        >
          {view.activeOverlay!.replace(/^winner\s*/i, "")}
        </h1>
        <Scoreboard view={view} className="mt-12" />
      </div>
    );

  if (
    view.mode !== "setlist" &&
    (overlay === "score" || overlay === "box score" || overlay === "score rotation")
  )
    return (
      <div className="px-8 text-center">
        <h1 className="text-5xl font-black uppercase tracking-widest text-white/70">
          {overlay === "score rotation" ? "Rotation!" : "Scoreboard"}
        </h1>
        <Scoreboard view={view} className="mt-10" big />
        {overlay === "box score" && <BoxScore view={view} />}
      </div>
    );

  if (overlay === "suggestions")
    return (
      <div className="px-8 text-center">
        <h1 className="text-7xl font-black text-sky-400">Suggestions?</h1>
        <p className="mt-6 text-3xl text-white/70">
          Shout out a place, a job, and a problem!
        </p>
      </div>
    );

  if (overlay === "crowd")
    return (
      <div className="px-8 text-center">
        <h1 className={"text-fuchsia-400 " + titleCls}>CROWD</h1>
        <p className="mt-6 text-3xl text-white/70">Make some noise!</p>
      </div>
    );

  if (overlay === "punishment")
    return (
      <div className="px-8 text-center">
        <h1 className={"text-red-500 " + titleCls}>PUNISHMENT</h1>
      </div>
    );

  if (overlay === "ring")
    return (
      <div className="px-8 text-center">
        <h1 className={"text-sky-400 " + titleCls}>RING</h1>
      </div>
    );

  if (overlay === "introduction" || overlay.startsWith("introduction"))
    return (
      <div className="px-8 text-center">
        <p className={subCls}>Introducing</p>
        <h1 className={"mt-4 text-amber-400 " + titleCls}>
          {(view.activeOverlay ?? "Introduction").replace(/^introduction:\s*/i, "")}
        </h1>
      </div>
    );

  if (overlay === "games")
    return (
      <div className="px-8 text-center">
        <h1 className="text-4xl font-black uppercase tracking-widest text-white/70">
          Tonight&apos;s games
        </h1>
        <ul className="mt-8 space-y-3 text-3xl font-bold">
          {view.games
            .filter((g) => g.teamIndex === 1)
            .map((g) => (
              <li key={g._id} className={g.isPlayed ? "text-white/30 line-through" : ""}>
                {g.round}. {g.gameName}
              </li>
            ))}
        </ul>
      </div>
    );

  // Default: title card (hidden when a designed scene is already filling the screen).
  if (compact) return null;
  return (
    <div className="px-8 text-center">
      <h1 className={titleCls}>{view.title}</h1>
      {view.mode === "setlist" ? (
        <p className="mt-10 text-3xl font-semibold uppercase tracking-widest text-white/50">
          Set list
        </p>
      ) : (
        <div className="mt-10 flex items-center justify-center gap-12 text-5xl font-black">
          <span className="text-yellow-300">{view.team1}</span>
          <span className="text-2xl text-white/40">vs</span>
          <span className="text-pink-400">{view.team2}</span>
        </div>
      )}
    </div>
  );
}

function Scoreboard({
  view,
  className = "",
  big = false,
}: {
  view: PerformanceView;
  className?: string;
  big?: boolean;
}) {
  return (
    <div className={"flex items-center justify-center gap-16 " + className}>
      {([1, 2] as const).map((t) => (
        <div key={t} className="text-center">
          <p
            className={
              "font-bold " +
              (t === 1 ? "text-yellow-300" : "text-pink-400") +
              (big ? " text-4xl" : " text-2xl")
            }
          >
            {teamName(view, t)}
          </p>
          <p className={"font-black " + (big ? "text-9xl" : "text-6xl")}>
            {t === 1 ? view.scores.team1 : view.scores.team2}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Per-round results table (legacy Box Score overlay). */
function BoxScore({ view }: { view: PerformanceView }) {
  const rounds = [...new Set(view.games.map((g) => g.round))];
  return (
    <table className="mx-auto mt-10 text-2xl">
      <thead>
        <tr className="text-white/50">
          <th className="px-4 py-1 text-left">Round</th>
          <th className="px-4 py-1 text-yellow-300">{view.team1}</th>
          <th className="px-4 py-1 text-pink-400">{view.team2}</th>
        </tr>
      </thead>
      <tbody>
        {rounds.map((r) => {
          const g1 = view.games.find((g) => g.round === r && g.teamIndex === 1);
          const g2 = view.games.find((g) => g.round === r && g.teamIndex === 2);
          return (
            <tr key={r}>
              <td className="px-4 py-1 text-left text-white/70">
                {r}. {g1?.roundType}
              </td>
              <td className="px-4 py-1 font-bold">{g1?.score ?? 0}</td>
              <td className="px-4 py-1 font-bold">{g2?.score ?? 0}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
