"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@linkall/backend/convex/_generated/api";
import {
  LOCOS,
  locoPaths,
  rowTag,
  type LocoConfig,
} from "@linkall/backend/convex/locos";
import { EmptyState, Loading } from "./empty-state";
import { PerformanceNightRows } from "./performance-nights";

type PerformanceRow = FunctionReturnType<typeof api.game.list>[number];

/**
 * Hub of FunFirst loco formats. Each section lists that loco's performances
 * (the nights you Run / Screen), plus links to its console and games catalog.
 */
export function LocoHub() {
  const all = useQuery(api.game.list, {});

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Locos</h1>
      <p className="mt-1 text-sm text-gray-500">
        Live show formats — performances, console, and game catalogs.
      </p>

      <div className="mt-6 space-y-8">
        {LOCOS.map((loco) => (
          <LocoSection
            key={loco.tag}
            loco={loco}
            performances={all?.filter((p) => rowTag(p.tag) === loco.tag)}
          />
        ))}
      </div>
    </div>
  );
}

function LocoSection({
  loco,
  performances,
}: {
  loco: LocoConfig;
  performances: PerformanceRow[] | undefined;
}) {
  const paths = locoPaths(loco.slug);

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className={`h-2 bg-gradient-to-r ${loco.accent}`} />
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">{loco.name}</h2>
          <Link
            href={paths.performances}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            All performances
          </Link>
          <Link
            href={paths.performance}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Console
          </Link>
          <Link
            href={paths.games}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Games
          </Link>
        </div>
        <p className="mt-1 text-sm text-gray-500">{loco.blurb}</p>
        <p className="mt-1 text-xs text-gray-400">
          {loco.team1} vs {loco.team2} · {loco.templateRounds.length} rounds
        </p>

        <div className="mt-4">
          {performances === undefined ? (
            <Loading />
          ) : performances.length === 0 ? (
            <EmptyState
              title={`No ${loco.name} performances yet`}
              hint="Open All performances to create one, or seed the FunFirst database."
            />
          ) : (
            <PerformanceNightRows
              performances={performances}
              slug={loco.slug}
            />
          )}
        </div>
      </div>
    </section>
  );
}
