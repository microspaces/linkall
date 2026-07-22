"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Doc, Id } from "@linkall/backend/convex/_generated/dataModel";
import { useCurrentUser } from "./current-user";
import { EmptyState, Loading } from "./empty-state";

/**
 * Show Designer (legacy: Homeshow/Surroundshow Designer).
 *
 * Shows tab:   Show | Scene | Effect drill-down grids + live preview + timeline.
 * Screens tab: Layout | Screen | Panel grids + draggable polygon editor.
 */

type Point = { x: number; y: number };
type Panel = Doc<"panels">;
type Screen = Doc<"screens"> & { panels: Panel[] };
type EffectRow = Doc<"effects"> & {
  panelName: string;
  screenName: string;
  zIndex: number;
};

// ---------------------------------------------------------------- helpers

function polygonCss(points: Point[], width: number, height: number) {
  return `polygon(${points
    .map((p) => `${(p.x / width) * 100}% ${(p.y / height) * 100}%`)
    .join(", ")})`;
}

function bbox(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------- stage

/**
 * Renders one physical screen with its panels filled by the given effects,
 * using CSS clip-path polygons. Shared by the designer preview and the live
 * show player.
 */
export function PanelStage({
  screen,
  effects,
  clockSec,
}: {
  screen: Screen;
  effects: Pick<Doc<"effects">, "panelId" | "kind" | "content" | "startTime" | "isEnabled">[];
  /** Seconds into the scene; effects appear once clock passes startTime. */
  clockSec: number;
}) {
  // Per panel: the enabled effect with the highest startTime <= clock wins.
  const active = new Map<string, (typeof effects)[number]>();
  for (const e of effects) {
    if (!e.isEnabled || e.startTime > clockSec) continue;
    const current = active.get(e.panelId);
    if (!current || e.startTime >= current.startTime) active.set(e.panelId, e);
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-gray-950"
      style={{ aspectRatio: `${screen.width} / ${screen.height}` }}
    >
      {screen.panels.map((panel) => {
        const effect = active.get(panel._id);
        const clip = polygonCss(panel.points, screen.width, screen.height);
        const style: CSSProperties = {
          clipPath: clip,
          zIndex: panel.zIndex,
        };
        const box = bbox(panel.points);
        return (
          <div key={panel._id} className="absolute inset-0" style={style}>
            {effect === undefined ? (
              <div className="h-full w-full bg-gray-800/60" />
            ) : effect.kind === "color" ? (
              <div
                className="h-full w-full"
                style={{ backgroundColor: effect.content }}
              />
            ) : effect.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={effect.content}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : effect.kind === "video" ? (
              <video
                src={effect.content}
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-red-900">
                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    left: `${(box.minX / screen.width) * 100}%`,
                    top: `${(box.minY / screen.height) * 100}%`,
                    width: `${(box.w / screen.width) * 100}%`,
                    height: `${(box.h / screen.height) * 100}%`,
                  }}
                >
                  <span
                    className="px-2 text-center font-serif font-bold text-amber-100"
                    style={{ fontSize: "clamp(0.8rem, 3vw, 2.2rem)" }}
                  >
                    {effect.content}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- modal

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

// ------------------------------------------------------------ grid chrome

function Column({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between bg-brand-dark px-3 py-2">
        <span className="text-sm font-semibold text-white">{title}</span>
        {onAdd && (
          <button
            onClick={onAdd}
            className="rounded px-1.5 text-lg leading-none text-white/80 hover:bg-white/10 hover:text-white"
            title={`Add ${title.toLowerCase()}`}
          >
            +
          </button>
        )}
      </div>
      <div className="max-h-72 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function Row({
  selected,
  onSelect,
  onEdit,
  onDelete,
  children,
}: {
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={
        "group flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm " +
        (selected ? "bg-brand-light text-brand-dark" : "hover:bg-gray-50")
      }
      onClick={onSelect}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="rounded p-1 text-gray-300 hover:text-brand group-hover:text-gray-400"
          title="Edit"
        >
          ✎
        </button>
      )}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm("Delete this item (and everything under it)?"))
              onDelete();
          }}
          className="rounded p-1 text-gray-300 hover:text-red-600 group-hover:text-gray-400"
          title="Delete"
        >
          🗑
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------------- effect thumb

function EffectThumb({
  kind,
  content,
  className = "h-8 w-12",
}: {
  kind: string;
  content: string;
  className?: string;
}) {
  if (kind === "color")
    return (
      <div
        className={`${className} shrink-0 rounded border border-gray-200`}
        style={{ backgroundColor: content }}
      />
    );
  if (kind === "image")
    return (
      <div
        className={`${className} shrink-0 rounded border border-gray-200 bg-cover bg-center`}
        style={{ backgroundImage: `url(${content})` }}
      />
    );
  if (kind === "video")
    return (
      <div
        className={`${className} flex shrink-0 items-center justify-center rounded border border-gray-700 bg-gray-900 text-xs text-white`}
      >
        ▶
      </div>
    );
  return (
    <div
      className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-amber-50 px-1 text-[9px] text-amber-800`}
    >
      {content.slice(0, 12)}
    </div>
  );
}

// ---------------------------------------------------------------- timeline

function Timeline({
  panels,
  effects,
  durationSec,
  playheadSec,
}: {
  panels: { panel: Panel; label: string }[];
  effects: EffectRow[];
  durationSec: number;
  playheadSec: number | null;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between bg-gray-900 px-3 py-2">
        <span className="text-sm font-semibold text-white">Timeline</span>
        <span className="text-xs text-gray-400">
          scene length {formatClock(durationSec)}
        </span>
      </div>
      <div className="relative">
        {panels.map(({ panel, label }) => {
          const rows = effects.filter((e) => e.panelId === panel._id);
          return (
            <div
              key={panel._id}
              className="flex items-stretch border-b border-gray-100"
            >
              <div className="w-28 shrink-0 border-r border-gray-100 px-2 py-2 text-xs font-semibold text-gray-600">
                {label}
              </div>
              <div className="relative h-9 flex-1 bg-gray-50">
                {rows.map((e) => {
                  const left = Math.min((e.startTime / durationSec) * 100, 100);
                  return (
                    <div
                      key={e._id}
                      className={
                        "absolute inset-y-1 overflow-hidden rounded border " +
                        (e.isEnabled
                          ? "border-gray-300"
                          : "border-dashed border-gray-300 opacity-40")
                      }
                      style={{
                        left: `${left}%`,
                        right: 0,
                        ...(e.kind === "color"
                          ? { backgroundColor: e.content }
                          : e.kind === "image"
                            ? {
                                backgroundImage: `url(${e.content})`,
                                backgroundSize: "auto 100%",
                                backgroundRepeat: "repeat-x",
                              }
                            : e.kind === "video"
                              ? { backgroundColor: "#111827" }
                              : { backgroundColor: "#fef3c7" }),
                      }}
                      title={`${e.panelName} @ ${formatClock(e.startTime)}`}
                    >
                      {e.kind === "video" && (
                        <span className="px-1 text-[9px] text-white">
                          ▶ video
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {playheadSec !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-red-500"
            style={{
              left: `calc(7rem + (100% - 7rem) * ${Math.min(playheadSec / durationSec, 1)})`,
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- shows tab

function ShowsTab() {
  const { userId } = useCurrentUser();
  const shows = useQuery(api.shows.list, {});
  const layouts = useQuery(api.designer.listLayouts);

  const [selectedShowId, setSelectedShowId] = useState<Id<"shows"> | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<Id<"scenes"> | null>(null);
  const [screenIndex, setScreenIndex] = useState(0);
  const [modal, setModal] = useState<
    | { type: "show"; show?: Doc<"shows"> }
    | { type: "scene"; scene?: Doc<"scenes"> }
    | { type: "effect"; effect?: EffectRow }
    | null
  >(null);

  const show =
    shows?.find((s) => s._id === selectedShowId) ?? shows?.[0] ?? null;
  const scenes = useQuery(
    api.designer.getShowScenes,
    show ? { showId: show._id } : "skip",
  );
  const scene =
    scenes?.find((s) => s._id === selectedSceneId) ?? scenes?.[0] ?? null;
  const effects = useQuery(
    api.designer.getSceneEffects,
    scene ? { sceneId: scene._id } : "skip",
  );
  const layout = useQuery(
    api.designer.getLayout,
    show?.layoutId ? { layoutId: show.layoutId } : "skip",
  );

  // Preview playback clock.
  const durationSec = scene?.durationSec ?? 60;
  const [playing, setPlaying] = useState(false);
  const [clock, setClock] = useState<number | null>(null);
  const playStartRef = useRef(0);
  useEffect(() => {
    if (!playing) return;
    playStartRef.current = Date.now();
    setClock(0);
    const t = setInterval(() => {
      const elapsed = (Date.now() - playStartRef.current) / 1000;
      if (elapsed >= durationSec) {
        setPlaying(false);
        setClock(null);
      } else {
        setClock(elapsed);
      }
    }, 100);
    return () => clearInterval(t);
  }, [playing, durationSec]);
  // Stop playback when switching scenes.
  useEffect(() => {
    setPlaying(false);
    setClock(null);
  }, [scene?._id]);

  const deleteShow = useMutation(api.designer.deleteShow);
  const deleteScene = useMutation(api.designer.deleteScene);
  const deleteEffect = useMutation(api.designer.deleteEffect);

  if (shows === undefined || layouts === undefined) return <Loading />;

  const screens: Screen[] = layout?.screens ?? [];
  const screen = screens[Math.min(screenIndex, screens.length - 1)];
  const panelLanes = screens.flatMap((s) =>
    s.panels.map((panel) => ({
      panel,
      label: screens.length > 1 ? `${s.name} · ${panel.name}` : panel.name,
    })),
  );
  const previewClock = clock ?? durationSec; // stopped = fully composed scene

  return (
    <div className="space-y-4">
      {/* Preview + timeline */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center gap-2 bg-gray-900 px-3 py-2">
            <span className="text-sm font-semibold text-white">
              {screen?.name ?? "Preview"}
            </span>
            {screens.length > 1 && (
              <select
                className="rounded bg-gray-700 px-1 py-0.5 text-xs text-white"
                value={screenIndex}
                onChange={(e) => setScreenIndex(Number(e.target.value))}
              >
                {screens.map((s, i) => (
                  <option key={s._id} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <span className="ml-auto text-xs text-gray-400">
              {playing && clock !== null
                ? `${formatClock(clock)} / ${formatClock(durationSec)}`
                : scene?.title ?? ""}
            </span>
            <button
              onClick={() => setPlaying((p) => !p)}
              disabled={!scene || !screen}
              className={
                "rounded-full px-3 py-0.5 text-xs font-bold " +
                (playing
                  ? "bg-gray-600 text-white"
                  : "bg-red-600 text-white hover:bg-red-500")
              }
            >
              {playing ? "Stop" : "Play"}
            </button>
          </div>
          <div className="p-3">
            {screen && effects ? (
              <PanelStage
                screen={screen}
                effects={effects}
                clockSec={previewClock}
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
                {show
                  ? show.layoutId
                    ? "Select a scene"
                    : "Assign a layout to this show (edit the show) to preview panels"
                  : "Create a show to get started"}
              </div>
            )}
          </div>
        </div>

        {scene && panelLanes.length > 0 && effects ? (
          <Timeline
            panels={panelLanes}
            effects={effects}
            durationSec={durationSec}
            playheadSec={clock}
          />
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-400">
            Timeline appears when a scene and layout are selected
          </div>
        )}
      </div>

      {/* Show | Scene | Effect columns */}
      <div className="flex flex-col gap-4 md:flex-row">
        <Column title="Show" onAdd={() => setModal({ type: "show" })}>
          {shows.length === 0 && (
            <p className="p-3 text-xs text-gray-400">No shows yet — add one.</p>
          )}
          {shows.map((s) => (
            <Row
              key={s._id}
              selected={show?._id === s._id}
              onSelect={() => {
                setSelectedShowId(s._id);
                setSelectedSceneId(null);
              }}
              onEdit={() => setModal({ type: "show", show: s })}
              onDelete={() => deleteShow({ showId: s._id })}
            >
              <span className="font-medium">{s.title}</span>
            </Row>
          ))}
        </Column>

        <Column
          title="Scene"
          onAdd={show ? () => setModal({ type: "scene" }) : undefined}
        >
          {!show && <p className="p-3 text-xs text-gray-400">Select a show.</p>}
          {scenes?.map((s) => (
            <Row
              key={s._id}
              selected={scene?._id === s._id}
              onSelect={() => setSelectedSceneId(s._id)}
              onEdit={() => setModal({ type: "scene", scene: s })}
              onDelete={() => deleteScene({ sceneId: s._id })}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{s.title}</span>
                <span className="text-xs text-gray-400">
                  {s.durationSec ?? "—"}
                </span>
              </div>
            </Row>
          ))}
        </Column>

        <Column
          title="Effect"
          onAdd={
            scene && panelLanes.length > 0
              ? () => setModal({ type: "effect" })
              : undefined
          }
        >
          {!scene && <p className="p-3 text-xs text-gray-400">Select a scene.</p>}
          {scene && panelLanes.length === 0 && (
            <p className="p-3 text-xs text-gray-400">
              The show needs a layout with panels first (Screens tab).
            </p>
          )}
          {effects?.map((e) => (
            <Row
              key={e._id}
              onEdit={() => setModal({ type: "effect", effect: e })}
              onDelete={() => deleteEffect({ effectId: e._id })}
            >
              <div className="flex items-center gap-2">
                <EffectThumb kind={e.kind} content={e.content} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.panelName}</p>
                  <p className="text-xs text-gray-400">
                    {e.kind} · starts {formatClock(e.startTime)}
                    {e.isEnabled ? "" : " · disabled"}
                  </p>
                </div>
              </div>
            </Row>
          ))}
        </Column>
      </div>

      {/* Modals */}
      {modal?.type === "show" && userId && (
        <ShowModal
          show={modal.show}
          layouts={layouts}
          ownerId={userId}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "scene" && show && (
        <SceneModal
          showId={show._id}
          scene={modal.scene}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "effect" && scene && (
        <EffectModal
          sceneId={scene._id}
          effect={modal.effect}
          panels={panelLanes}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function ShowModal({
  show,
  layouts,
  ownerId,
  onClose,
}: {
  show?: Doc<"shows">;
  layouts: Doc<"layouts">[];
  ownerId: Id<"users">;
  onClose: () => void;
}) {
  const createShow = useMutation(api.shows.create);
  const updateShow = useMutation(api.designer.updateShow);
  const [title, setTitle] = useState(show?.title ?? "");
  const [description, setDescription] = useState(show?.description ?? "");
  const [layoutId, setLayoutId] = useState<string>(
    show?.layoutId ?? layouts[0]?._id ?? "",
  );

  const save = async () => {
    if (!title.trim()) return;
    const layout = layoutId ? (layoutId as Id<"layouts">) : undefined;
    if (show) {
      await updateShow({ showId: show._id, title, description, layoutId: layout });
    } else {
      await createShow({ title, description, ownerId, layoutId: layout });
    }
    onClose();
  };

  return (
    <Modal title={show ? "Edit show" : "New show"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Description">
          <input
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="Layout">
          <select
            className={inputCls}
            value={layoutId}
            onChange={(e) => setLayoutId(e.target.value)}
          >
            <option value="">(none)</option>
            {layouts.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <button
          onClick={save}
          className="w-full rounded-md bg-brand py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

function SceneModal({
  showId,
  scene,
  onClose,
}: {
  showId: Id<"shows">;
  scene?: Doc<"scenes">;
  onClose: () => void;
}) {
  const createScene = useMutation(api.designer.createScene);
  const updateScene = useMutation(api.designer.updateScene);
  const [title, setTitle] = useState(scene?.title ?? "");
  const [duration, setDuration] = useState(String(scene?.durationSec ?? 60));

  const save = async () => {
    if (!title.trim()) return;
    const durationSec = Math.max(1, Number(duration) || 60);
    if (scene) {
      await updateScene({ sceneId: scene._id, title, durationSec });
    } else {
      await createScene({ showId, title, durationSec });
    }
    onClose();
  };

  return (
    <Modal title={scene ? "Edit scene" : "New scene"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Duration (seconds)">
          <input
            className={inputCls}
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </Field>
        <button
          onClick={save}
          className="w-full rounded-md bg-brand py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

function EffectModal({
  sceneId,
  effect,
  panels,
  onClose,
}: {
  sceneId: Id<"scenes">;
  effect?: EffectRow;
  panels: { panel: Panel; label: string }[];
  onClose: () => void;
}) {
  const createEffect = useMutation(api.designer.createEffect);
  const updateEffect = useMutation(api.designer.updateEffect);
  const [panelId, setPanelId] = useState<string>(
    effect?.panelId ?? panels[0]?.panel._id ?? "",
  );
  const [kind, setKind] = useState<"image" | "video" | "color" | "text">(
    effect?.kind ?? "color",
  );
  const [content, setContent] = useState(effect?.content ?? "#dc2626");
  const [startTime, setStartTime] = useState(String(effect?.startTime ?? 0));
  const [isEnabled, setIsEnabled] = useState(effect?.isEnabled ?? true);

  const save = async () => {
    if (!panelId) return;
    const args = {
      panelId: panelId as Id<"panels">,
      kind,
      content,
      startTime: Math.max(0, Number(startTime) || 0),
    };
    if (effect) {
      await updateEffect({ effectId: effect._id, ...args, isEnabled });
    } else {
      await createEffect({ sceneId, ...args });
    }
    onClose();
  };

  return (
    <Modal title={effect ? "Edit effect" : "New effect"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Panel">
          <select
            className={inputCls}
            value={panelId}
            onChange={(e) => setPanelId(e.target.value)}
          >
            {panels.map(({ panel, label }) => (
              <option key={panel._id} value={panel._id}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select
            className={inputCls}
            value={kind}
            onChange={(e) => {
              const k = e.target.value as typeof kind;
              setKind(k);
              if (k === "color" && !content.startsWith("#")) setContent("#dc2626");
            }}
          >
            <option value="color">Color</option>
            <option value="image">Image URL</option>
            <option value="video">Video URL</option>
            <option value="text">Text</option>
          </select>
        </Field>
        <Field
          label={
            kind === "color"
              ? "Color"
              : kind === "text"
                ? "Text"
                : `${kind[0].toUpperCase() + kind.slice(1)} URL`
          }
        >
          {kind === "color" ? (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(content) ? content : "#dc2626"}
                onChange={(e) => setContent(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300"
              />
              <input
                className={inputCls}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          ) : (
            <input
              className={inputCls}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={kind === "text" ? "Merry Christmas" : "https://…"}
            />
          )}
        </Field>
        <Field label="Start time (seconds into scene)">
          <input
            className={inputCls}
            type="number"
            min={0}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </Field>
        {effect && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
            />
            Enabled
          </label>
        )}
        <button
          onClick={save}
          className="w-full rounded-md bg-brand py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

// -------------------------------------------------------------- screens tab

export const PANEL_FILLS = [
  "#f87171",
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#f472b6",
  "#38bdf8",
  "#fb923c",
];

function ScreensTab() {
  const { userId } = useCurrentUser();
  const layouts = useQuery(api.designer.listLayouts);
  const [selectedLayoutId, setSelectedLayoutId] = useState<Id<"layouts"> | null>(null);
  const [selectedScreenId, setSelectedScreenId] = useState<Id<"screens"> | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<Id<"panels"> | null>(null);

  const layoutDoc =
    layouts?.find((l) => l._id === selectedLayoutId) ?? layouts?.[0] ?? null;
  const layout = useQuery(
    api.designer.getLayout,
    layoutDoc ? { layoutId: layoutDoc._id } : "skip",
  );

  const createLayout = useMutation(api.designer.createLayout);
  const updateLayout = useMutation(api.designer.updateLayout);
  const deleteLayout = useMutation(api.designer.deleteLayout);
  const createScreen = useMutation(api.designer.createScreen);
  const updateScreen = useMutation(api.designer.updateScreen);
  const deleteScreen = useMutation(api.designer.deleteScreen);
  const createPanel = useMutation(api.designer.createPanel);
  const updatePanel = useMutation(api.designer.updatePanel);
  const deletePanel = useMutation(api.designer.deletePanel);

  if (layouts === undefined) return <Loading />;

  const screens = layout?.screens ?? [];
  const screen =
    screens.find((s) => s._id === selectedScreenId) ?? screens[0] ?? null;
  const panel =
    screen?.panels.find((p) => p._id === selectedPanelId) ?? null;

  const prompt = (label: string, current = "") => {
    const value = window.prompt(label, current);
    return value?.trim() ? value.trim() : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row">
        <Column
          title="Layout"
          onAdd={
            userId
              ? async () => {
                  const name = prompt("Layout name");
                  if (name) await createLayout({ name, ownerId: userId });
                }
              : undefined
          }
        >
          {layouts.length === 0 && (
            <p className="p-3 text-xs text-gray-400">No layouts yet — add one.</p>
          )}
          {layouts.map((l) => (
            <Row
              key={l._id}
              selected={layoutDoc?._id === l._id}
              onSelect={() => {
                setSelectedLayoutId(l._id);
                setSelectedScreenId(null);
                setSelectedPanelId(null);
              }}
              onEdit={async () => {
                const name = prompt("Layout name", l.name);
                if (name) await updateLayout({ layoutId: l._id, name });
              }}
              onDelete={() => deleteLayout({ layoutId: l._id })}
            >
              <span className="font-medium">{l.name}</span>
            </Row>
          ))}
        </Column>

        <Column
          title="Screen"
          onAdd={
            layoutDoc
              ? async () => {
                  const name = prompt("Screen name");
                  if (name)
                    await createScreen({ layoutId: layoutDoc._id, name });
                }
              : undefined
          }
        >
          {!layoutDoc && (
            <p className="p-3 text-xs text-gray-400">Select a layout.</p>
          )}
          {screens.map((s) => (
            <Row
              key={s._id}
              selected={screen?._id === s._id}
              onSelect={() => {
                setSelectedScreenId(s._id);
                setSelectedPanelId(null);
              }}
              onEdit={async () => {
                const name = prompt("Screen name", s.name);
                if (name) await updateScreen({ screenId: s._id, name });
              }}
              onDelete={() => deleteScreen({ screenId: s._id })}
            >
              <span className="font-medium">{s.name}</span>
            </Row>
          ))}
        </Column>

        <Column
          title="Panel"
          onAdd={
            screen
              ? async () => {
                  const name = prompt("Panel name");
                  if (name) await createPanel({ screenId: screen._id, name });
                }
              : undefined
          }
        >
          {!screen && (
            <p className="p-3 text-xs text-gray-400">Select a screen.</p>
          )}
          {screen?.panels.map((p, i) => (
            <Row
              key={p._id}
              selected={panel?._id === p._id}
              onSelect={() => setSelectedPanelId(p._id)}
              onEdit={async () => {
                const name = prompt("Panel name", p.name);
                if (name) await updatePanel({ panelId: p._id, name });
              }}
              onDelete={() => deletePanel({ panelId: p._id })}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: PANEL_FILLS[i % PANEL_FILLS.length] }}
                />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto text-xs text-gray-400">
                  {p.points.length} pts
                </span>
              </div>
            </Row>
          ))}
        </Column>
      </div>

      {screen ? (
        <PanelEditor
          key={screen._id}
          screen={screen}
          selectedPanelId={panel?._id ?? null}
          onSelectPanel={setSelectedPanelId}
          onSavePoints={(panelId, points) => updatePanel({ panelId, points })}
        />
      ) : (
        <EmptyState
          title="No screen selected"
          hint="Create a layout and a screen, then add panels and drag their corners into place."
        />
      )}
    </div>
  );
}

/** SVG polygon editor: click a panel to select it, drag its corners to reshape. */
function PanelEditor({
  screen,
  selectedPanelId,
  onSelectPanel,
  onSavePoints,
}: {
  screen: Screen;
  selectedPanelId: Id<"panels"> | null;
  onSelectPanel: (id: Id<"panels">) => void;
  onSavePoints: (panelId: Id<"panels">, points: Point[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Local override while dragging, keyed by panel id.
  const [draftPoints, setDraftPoints] = useState<Record<string, Point[]>>({});
  const dragRef = useRef<{ panelId: Id<"panels">; pointIndex: number } | null>(null);

  const toSvgCoords = (e: { clientX: number; clientY: number }): Point => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * screen.width),
      y: Math.round(((e.clientY - rect.top) / rect.height) * screen.height),
    };
  };

  const pointsOf = (panel: Panel) => draftPoints[panel._id] ?? panel.points;

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pos = toSvgCoords(e);
    pos.x = Math.max(0, Math.min(screen.width, pos.x));
    pos.y = Math.max(0, Math.min(screen.height, pos.y));
    setDraftPoints((prev) => {
      const panel = screen.panels.find((p) => p._id === drag.panelId);
      if (!panel) return prev;
      const pts = [...(prev[drag.panelId] ?? panel.points)];
      pts[drag.pointIndex] = pos;
      return { ...prev, [drag.panelId]: pts };
    });
  };

  const endDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const pts = draftPoints[drag.panelId];
    if (pts) onSavePoints(drag.panelId, pts);
  };

  const selected = screen.panels.find((p) => p._id === selectedPanelId);

  const addPoint = () => {
    if (!selected || selected.points.length >= 5) return;
    const pts = pointsOf(selected);
    const a = pts[pts.length - 1];
    const b = pts[0];
    const mid = { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
    onSavePoints(selected._id, [...pts, mid]);
  };

  const removePoint = () => {
    if (!selected || selected.points.length <= 3) return;
    onSavePoints(selected._id, pointsOf(selected).slice(0, -1));
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 bg-gray-900 px-3 py-2">
        <span className="text-sm font-semibold text-white">
          {screen.name} — panel editor
        </span>
        <span className="text-xs text-gray-400">
          drag the corner handles to reshape panels
        </span>
        {selected && (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-300">{selected.name}</span>
            <button
              onClick={addPoint}
              disabled={selected.points.length >= 5}
              className="rounded bg-gray-700 px-2 py-0.5 text-xs text-white disabled:opacity-40"
            >
              + point
            </button>
            <button
              onClick={removePoint}
              disabled={selected.points.length <= 3}
              className="rounded bg-gray-700 px-2 py-0.5 text-xs text-white disabled:opacity-40"
            >
              − point
            </button>
          </span>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${screen.width} ${screen.height}`}
        className="w-full touch-none select-none bg-gray-950"
        style={{ aspectRatio: `${screen.width} / ${screen.height}` }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        {screen.panels.map((p, i) => {
          const pts = pointsOf(p);
          const isSel = p._id === selectedPanelId;
          const fill = PANEL_FILLS[i % PANEL_FILLS.length];
          const box = bbox(pts);
          return (
            <g key={p._id}>
              <polygon
                points={pts.map((pt) => `${pt.x},${pt.y}`).join(" ")}
                fill={fill}
                fillOpacity={isSel ? 0.75 : 0.35}
                stroke={isSel ? "#fff" : fill}
                strokeWidth={isSel ? 3 : 1.5}
                className="cursor-pointer"
                onClick={() => onSelectPanel(p._id)}
              />
              <text
                x={box.minX + box.w / 2}
                y={box.minY + box.h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize={Math.max(12, screen.width / 55)}
                className="pointer-events-none font-sans"
              >
                {p.name}
              </text>
              {isSel &&
                pts.map((pt, pi) => (
                  <circle
                    key={pi}
                    cx={pt.x}
                    cy={pt.y}
                    r={screen.width / 70}
                    fill="#fff"
                    stroke="#111827"
                    strokeWidth={2}
                    className="cursor-grab"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                      dragRef.current = { panelId: p._id, pointIndex: pi };
                    }}
                  />
                ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------- designer

export function ShowDesigner() {
  const [tab, setTab] = useState<"shows" | "screens">("shows");

  return (
    <div>
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Designer</h1>
      </div>
      <div className="mt-4 flex gap-1 border-b border-gray-200">
        {(["shows", "screens"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "rounded-t-lg px-4 py-2 text-sm font-semibold capitalize " +
              (tab === t
                ? "border border-b-0 border-gray-200 bg-white text-brand-dark"
                : "text-gray-500 hover:text-gray-800")
            }
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === "shows" ? <ShowsTab /> : <ScreensTab />}
      </div>
    </div>
  );
}
