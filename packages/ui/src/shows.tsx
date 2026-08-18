"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Doc, Id } from "@linkall/backend/convex/_generated/dataModel";
import { useBrand } from "./brand-context";
import { PanelStage } from "./designer";
import { EmptyState, Loading } from "./empty-state";

const STATUS_STYLE: Record<string, string> = {
  live: "bg-red-100 text-red-700",
  draft: "bg-gray-100 text-gray-500",
  ended: "bg-gray-100 text-gray-400 line-through",
};

export function ShowList({ tag }: { tag?: string }) {
  const brand = useBrand();
  const shows = useQuery(api.shows.list, { tag });

  if (shows === undefined) return <Loading />;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Shows</h1>
        {brand.showTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/shows"
              className={
                "rounded-full px-3 py-1 text-sm " +
                (!tag
                  ? "bg-brand text-white"
                  : "bg-white text-gray-600 border border-gray-200")
              }
            >
              All
            </Link>
            {brand.showTags.map((t) => (
              <Link
                key={t.tag}
                href={`/shows?tag=${t.tag}`}
                className={
                  "rounded-full px-3 py-1 text-sm " +
                  (tag === t.tag
                    ? "bg-brand text-white"
                    : "bg-white text-gray-600 border border-gray-200")
                }
              >
                {t.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {shows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No shows yet" />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shows.map((show) => (
            <Link
              key={show._id}
              href={`/shows/${show._id}`}
              className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-xs font-semibold uppercase " +
                    STATUS_STYLE[show.status]
                  }
                >
                  {show.status === "live" ? "● Live" : show.status}
                </span>
                {show.tag && (
                  <span className="text-xs text-gray-400">#{show.tag}</span>
                )}
              </div>
              <h3 className="mt-3 font-semibold text-gray-900">{show.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{show.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Panel-based scene playback: renders the show's layout screens with the
 * scene's effects appearing at their start times, measured from the moment
 * the operator switched to this scene (show.sceneStartedAt).
 */
/** Full-bleed playback of a designed scene (used by ShowPlayer + performance screen). */
export function DesignedSceneStage({
  show,
  scene,
}: {
  show: Pick<
    Doc<"shows">,
    "_id" | "layoutId" | "sceneStartedAt" | "cuedByPerformanceId"
  >;
  scene: Doc<"scenes">;
}) {
  if (scene.kind === "panels") {
    return <PanelSceneView show={show} scene={scene} />;
  }
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center">
      <SceneView scene={scene} />
    </div>
  );
}

function PanelSceneView({
  show,
  scene,
}: {
  show: Pick<
    Doc<"shows">,
    "layoutId" | "sceneStartedAt" | "cuedByPerformanceId"
  >;
  scene: Doc<"scenes">;
}) {
  const layout = useQuery(
    api.designer.getLayout,
    show.layoutId ? { layoutId: show.layoutId } : "skip",
  );
  const effects = useQuery(api.designer.getSceneEffects, {
    sceneId: scene._id,
  });
  const [clockSec, setClockSec] = useState(0);

  useEffect(() => {
    const startedAt = show.sceneStartedAt ?? Date.now();
    const tick = () => setClockSec((Date.now() - startedAt) / 1000);
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [show.sceneStartedAt, scene._id]);

  if (layout === undefined || effects === undefined)
    return <div className="py-24" />;
  if (!layout || layout.screens.length === 0)
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        This show&apos;s layout has no screens yet.
      </div>
    );

  return (
    <div className="grid gap-2 p-2">
      {layout.screens.map((screen) => (
        <PanelStage
          key={screen._id}
          screen={screen}
          effects={effects}
          clockSec={clockSec}
          urlContext={{ performanceId: show.cuedByPerformanceId }}
        />
      ))}
    </div>
  );
}

function SceneView({ scene }: { scene: Doc<"scenes"> }) {
  if (scene.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={scene.content}
        alt={scene.title}
        className="max-h-[420px] w-full rounded-lg object-cover"
      />
    );
  }
  if (scene.kind === "score") {
    let entries: [string, unknown][] = [];
    try {
      entries = Object.entries(JSON.parse(scene.content));
    } catch {
      entries = [["score", scene.content]];
    }
    return (
      <div className="flex flex-wrap items-center justify-center gap-10 py-16">
        {entries.map(([team, score]) => (
          <div key={team} className="text-center">
            <p className="text-lg font-medium uppercase tracking-wide text-white/70">
              {team}
            </p>
            <p className="text-7xl font-bold text-white">{String(score)}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center px-8 py-20">
      <p
        className={
          scene.kind === "title"
            ? "text-center text-4xl font-bold text-white"
            : "max-w-xl text-center text-xl text-white/90"
        }
      >
        {scene.content}
      </p>
    </div>
  );
}

/**
 * The Player/Screen for one show. In the legacy app the operator's Player
 * page pushed scene changes to every Screen via the SignalR DisplayHub; here
 * Convex's reactive query pushes the update to every viewer automatically.
 */
export function ShowPlayer({ showId }: { showId: Id<"shows"> }) {
  const show = useQuery(api.shows.get, { showId });
  const setStatus = useMutation(api.shows.setStatus);
  const setScene = useMutation(api.shows.setScene);

  if (show === undefined) return <Loading />;
  if (show === null) return <EmptyState title="Show not found" hint=" " />;

  const scene = show.scenes[show.currentSceneIndex];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{show.title}</h1>
          <p className="text-sm text-gray-500">{show.description}</p>
          <a
            href={`/preview?show=${showId}`}
            className="mt-1 inline-block text-sm font-semibold text-brand hover:underline"
          >
            Preview all screens
          </a>
        </div>
        <span
          className={
            "rounded-full px-3 py-1 text-sm font-semibold uppercase " +
            STATUS_STYLE[show.status]
          }
        >
          {show.status === "live" ? "● Live" : show.status}
        </span>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl bg-gray-950 shadow-lg">
        {show.status === "live" && scene ? (
          <DesignedSceneStage show={show} scene={scene} />
        ) : (
          <div className="flex items-center justify-center py-24 text-gray-500">
            {show.status === "ended"
              ? "This show has ended."
              : "Waiting for the show to start…"}
          </div>
        )}
      </div>

      {/* Operator controls (demo: visible to everyone; gate by role later). */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Operator controls — open this page in a second tab to see live sync
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {show.status !== "live" ? (
            <button
              onClick={() => setStatus({ showId, status: "live" })}
              className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              Go live
            </button>
          ) : (
            <>
              <button
                onClick={() =>
                  setScene({ showId, index: show.currentSceneIndex - 1 })
                }
                disabled={show.currentSceneIndex === 0}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="px-2 text-sm text-gray-500">
                Scene {show.currentSceneIndex + 1} / {show.scenes.length}
                {scene ? ` — ${scene.title}` : ""}
              </span>
              <button
                onClick={() =>
                  setScene({ showId, index: show.currentSceneIndex + 1 })
                }
                disabled={show.currentSceneIndex >= show.scenes.length - 1}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Next →
              </button>
              <button
                onClick={() => setStatus({ showId, status: "ended" })}
                className="ml-auto rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                End show
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-gray-900">Scenes</h2>
        <ol className="mt-3 space-y-2">
          {show.scenes.map((s, i) => (
            <li
              key={s._id}
              className={
                "flex items-center gap-3 rounded-lg border px-4 py-2 text-sm " +
                (i === show.currentSceneIndex && show.status === "live"
                  ? "border-brand bg-brand-light text-brand-dark"
                  : "border-gray-200 bg-white text-gray-600")
              }
            >
              <span className="w-6 text-gray-400">{i + 1}.</span>
              <span className="font-medium">{s.title}</span>
              <span className="ml-auto text-xs uppercase text-gray-400">
                {s.kind}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
