"use client";

import { useParams } from "next/navigation";
import { PerformanceScreen } from "@linkall/ui";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";

export default function PerformanceScreenPage() {
  const { id } = useParams<{ id: string }>();
  return <PerformanceScreen performanceId={id as Id<"performances">} />;
}
