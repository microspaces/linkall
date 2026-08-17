"use client";

import { useParams } from "next/navigation";
import { PerformanceList } from "@linkall/ui";

export default function LocoPerformancesPage() {
  const { slug } = useParams<{ slug: string }>();
  return <PerformanceList slug={slug} />;
}
