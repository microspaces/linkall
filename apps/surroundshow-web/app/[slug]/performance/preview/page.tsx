"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DisplayPreview } from "@linkall/ui";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";

function Preview() {
  const params = useSearchParams();
  const id = params.get("id") as Id<"performances"> | null;
  return <DisplayPreview performanceId={id} />;
}

export default function LocoPerformancePreviewPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <Preview />
    </Suspense>
  );
}
