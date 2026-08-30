"use client";

import { useParams, useSearchParams } from "next/navigation";
import { PerformanceOverlay } from "@linkall/ui";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";

const OVERLAY_ART: Record<string, string> = {
  "battle-loco": "https://battleloco.com/battle-loco/images/hero.jpg",
  "wrestle-loco": "/wrestle-loco/images/hero.jpg",
  "comedy-loco": "/comedy-loco/images/hero.jpg",
};

export default function LocoPerformanceOverlayPage() {
  const { slug, kind } = useParams<{ slug: string; kind: string }>();
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
      backdropUrl={OVERLAY_ART[slug]}
    />
  );
}
