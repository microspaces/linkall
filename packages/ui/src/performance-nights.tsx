"use client";

import Link from "next/link";
import type { FunctionReturnType } from "convex/server";
import { api } from "@linkall/backend/convex/_generated/api";
import { locoPaths } from "@linkall/backend/convex/locos";

type PerformanceRow = FunctionReturnType<typeof api.game.list>[number];

const STATUS_STYLE: Record<string, string> = {
  live: "bg-red-100 text-red-700",
  draft: "bg-gray-100 text-gray-500",
  ended: "bg-gray-100 text-gray-400 line-through",
};

export function PerformanceNightRows({
  performances,
  slug,
}: {
  performances: PerformanceRow[];
  slug: string;
}) {
  const paths = locoPaths(slug);
  return (
    <div className="space-y-3">
      {performances.map((p) => (
        <div
          key={p._id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-5"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-gray-900">{p.title}</h3>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-xs font-semibold uppercase " +
                  STATUS_STYLE[p.status]
                }
              >
                {p.status === "live" ? "● Live" : p.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              <span className="font-medium text-amber-600">{p.team1}</span>
              <span className="mx-1.5 text-gray-300">vs</span>
              <span className="font-medium text-pink-600">{p.team2}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`${paths.performance}?id=${p._id}`}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Run
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
