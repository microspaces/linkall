"use client";

import { useParams } from "next/navigation";
import { ScreenOutput } from "@linkall/ui";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";

export default function ScreenPage() {
  const { id } = useParams<{ id: string }>();
  return <ScreenOutput screenId={id as Id<"screens">} />;
}
