"use client";

import { useParams } from "next/navigation";
import { ResourceDetail } from "@linkall/ui";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";

export default function ResourcePage() {
  const { id } = useParams<{ id: string }>();
  return <ResourceDetail resourceId={id as Id<"resources">} />;
}
