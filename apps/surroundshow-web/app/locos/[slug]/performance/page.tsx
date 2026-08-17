"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loading, PerformanceConsole } from "@linkall/ui";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";

function Console() {
  const { slug } = useParams<{ slug: string }>();
  const params = useSearchParams();
  const id = params.get("id");
  return (
    <PerformanceConsole
      slug={slug}
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
