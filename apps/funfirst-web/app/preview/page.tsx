"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DisplayPreview } from "@linkall/ui";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";

function Preview() {
  const params = useSearchParams();
  const show = params.get("show") as Id<"shows"> | null;
  const profile = params.get("profile") as Id<"displayProfiles"> | null;
  const performance = params.get("performance") as Id<"performances"> | null;
  return (
    <DisplayPreview
      initialShowId={show}
      initialProfileId={profile}
      performanceId={performance}
    />
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <Preview />
    </Suspense>
  );
}
