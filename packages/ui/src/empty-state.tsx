"use client";

import { useBrand } from "./brand-context";

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  const brand = useBrand();
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
      <p className="font-medium text-gray-700">{title}</p>
      <p className="mt-2 text-sm text-gray-500">
        {hint ??
          `No data yet. Seed mock data with: pnpm --filter @linkall/backend seed:${brand.id}`}
      </p>
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center p-16 text-gray-400">
      <span className="animate-pulse">Loading…</span>
    </div>
  );
}
