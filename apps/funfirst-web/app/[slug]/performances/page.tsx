"use client";

import { useParams } from "next/navigation";
import { getLocoByRoute } from "@linkall/backend/convex/locos";
import { PerformanceList } from "@linkall/ui";

export default function LocoPerformancesPage() {
  const { slug, act } = useParams<{ slug: string; act?: string }>();
  const loco = getLocoByRoute(slug, act);
  if (!loco || loco.mode === "hub") return null;
  return <PerformanceList slug={loco.slug} />;
}
