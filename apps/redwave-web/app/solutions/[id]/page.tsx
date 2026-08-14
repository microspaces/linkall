"use client";

import { useParams } from "next/navigation";
import { SolutionDetail } from "@linkall/ui";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";

export default function SolutionPage() {
  const { id } = useParams<{ id: string }>();
  return <SolutionDetail solutionId={id as Id<"solutions">} />;
}
