"use client";

import { useParams } from "next/navigation";
import { GroupDetail } from "@linkall/ui";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <GroupDetail groupId={id as Id<"groups">} />;
}
