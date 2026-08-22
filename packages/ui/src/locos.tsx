"use client";

import Link from "next/link";
import {
  getLocoByRoute,
  getLocoBySlug,
  LOCOS,
  locoChildren,
  locoPaths,
  type LocoConfig,
} from "@linkall/backend/convex/locos";
import { useBrand } from "./brand-context";
import { EmptyState } from "./empty-state";

/**
 * Brand-scoped hub of loco formats. Cards are filtered to the current brand
 * so FunFirst and SurroundShow only list their own. Each card links to that
 * loco's performances, console, and games catalog.
 */
export function LocoHub() {
  const brand = useBrand();
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">
        {brand.id === "surroundshow"
          ? "HomeShow, Ceremony, Reception & Bar Loco"
          : "Locos"}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {brand.id === "surroundshow"
          ? "HomeShow plays holiday house bits. Wedding Ceremony and Wedding Reception are separate set lists. Bar Loco is the pop-up bar night."
          : "Competitions and set lists — open a format to run its performances."}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LOCOS.filter((l) => l.brand === brand.id && !l.parentSlug).map(
          (loco) => (
            <LocoCard key={loco.tag} loco={loco} />
          ),
        )}
      </div>
    </div>
  );
}

/** One named show at `/{slug}` — designer, player, and performance hang off it. */
export function LocoHome({
  slug,
  parentSlug,
}: {
  slug?: string;
  parentSlug?: string;
}) {
  const loco = parentSlug
    ? getLocoByRoute(parentSlug, slug)
    : getLocoBySlug(slug);
  if (!loco) {
    return (
      <div className="p-6">
        <EmptyState
          title="Unknown show"
          hint="That show isn't in the registry yet."
        />
        <Link
          href="/locos"
          className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
        >
          ← All shows
        </Link>
      </div>
    );
  }
  if (loco.mode === "hub") {
    const kids = locoChildren(loco.slug);
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{loco.name}</h1>
        <p className="mt-1 text-sm text-gray-500">{loco.blurb}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {kids.map((child) => (
            <LocoCard key={child.tag} loco={child} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      {loco.parentSlug && (
        <Link
          href={locoPaths(loco.parentSlug).home}
          className="mb-3 inline-block text-sm font-semibold text-brand hover:underline"
        >
          ← {getLocoBySlug(loco.parentSlug)?.name ?? "Back"}
        </Link>
      )}
      <LocoCard loco={loco} featured />
    </div>
  );
}

function LocoCard({
  loco,
  featured = false,
}: {
  loco: LocoConfig;
  featured?: boolean;
}) {
  const paths = locoPaths(loco.slug);
  const title = featured ? (
    <h1 className="text-2xl font-bold text-gray-900">{loco.name}</h1>
  ) : (
    <h2 className="text-lg font-bold text-gray-900">{loco.name}</h2>
  );
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className={`h-2 bg-gradient-to-r ${loco.accent}`} />
      <div className={featured ? "p-6" : "p-5"}>
        <div className="flex items-center gap-2">
          {title}
          {loco.mode === "setlist" && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Set list
            </span>
          )}
          {loco.mode === "hub" && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Two rooms
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">{loco.blurb}</p>
        <p className="mt-2 text-xs text-gray-400">
          {loco.mode === "hub"
            ? "Ceremony + Reception"
            : loco.mode === "setlist"
              ? `${loco.templateRounds.length} segments`
              : `${loco.team1} vs ${loco.team2} · ${loco.templateRounds.length} rounds`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {loco.mode === "hub" ? (
            <Link
              href={paths.home}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Open
            </Link>
          ) : (
            <>
          <Link
            href={paths.performances}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Performances
          </Link>
          <Link
            href={paths.performance}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Console
          </Link>
          <Link
            href={paths.designer}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Designer
          </Link>
          <Link
            href={paths.player}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Player
          </Link>
          <Link
            href={paths.games}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Games
          </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
