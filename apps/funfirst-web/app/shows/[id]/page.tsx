"use client";

import { useParams } from "next/navigation";
import { ShowPlayer } from "@linkall/ui";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";

export default function ShowPage() {
  const { id } = useParams<{ id: string }>();
  return <ShowPlayer showId={id as Id<"shows">} />;
}
