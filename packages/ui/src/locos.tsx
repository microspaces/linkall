"use client";

import Link from "next/link";
import { LOCOS, locoPaths } from "@linkall/backend/convex/locos";

/**
 * Hub of FunFirst loco formats (Comedy Loco, Battle Loco, Wrestle Loco,
 * HeadCase, LaffUp, This Game Show, Wedding Loco, Bar Loco). Each card links to that loco's
 * performances, console, and games catalog.
 */
export function LocoHub() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Locos</h1>
      <p className="mt-1 text-sm text-gray-500">
        Competitions and set lists — open a format to run its performances.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LOCOS.map((loco) => {
          const paths = locoPaths(loco.slug);
          return (
            <div
              key={loco.tag}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <div className={`h-2 bg-gradient-to-r ${loco.accent}`} />
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">{loco.name}</h2>
                  {loco.mode === "setlist" && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Set list
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500">{loco.blurb}</p>
                <p className="mt-2 text-xs text-gray-400">
                  {loco.mode === "setlist"
                    ? `${loco.templateRounds.length} segments`
                    : `${loco.team1} vs ${loco.team2} · ${loco.templateRounds.length} rounds`}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
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
                    href={paths.games}
                    className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Games
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
