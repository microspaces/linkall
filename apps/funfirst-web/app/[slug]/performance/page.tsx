"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getLocoByRoute } from "@linkall/backend/convex/locos";
import { Loading, PerformanceConsole } from "@linkall/ui";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";

function Console() {
  const { slug, act } = useParams<{ slug: string; act?: string }>();
  const params = useSearchParams();
  const id = params.get("id");
  const loco = getLocoByRoute(slug, act);
  if (!loco || loco.mode === "hub") return null;
  return (
    <PerformanceConsole
      slug={loco.slug}
      initialPerformanceId={id ? (id as Id<"performances">) : null}
    />
  );
}

export default function LocoPerformancePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Console />
    </Suspense>
  );
}
