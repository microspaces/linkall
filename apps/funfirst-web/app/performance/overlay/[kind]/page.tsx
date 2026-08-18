"use client";

import { useParams, useSearchParams } from "next/navigation";
import { PerformanceOverlay } from "@linkall/ui";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";

export default function ComedyPerformanceOverlayPage() {
  const { kind } = useParams<{ kind: string }>();
  const params = useSearchParams();
  const id = params.get("id");
  if (!id) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-gray-500">
        Missing performance id.
      </div>
    );
  }
  return (
    <PerformanceOverlay
      performanceId={id as Id<"performances">}
      kind={kind}
    />
  );
}
