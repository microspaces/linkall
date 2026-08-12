"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loading, PerformanceConsole } from "@linkall/ui";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";

function Performance() {
  const params = useSearchParams();
  const id = params.get("id");
  return (
    <PerformanceConsole
      initialPerformanceId={id ? (id as Id<"performances">) : null}
    />
  );
}

export default function PerformancePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Performance />
    </Suspense>
  );
}
