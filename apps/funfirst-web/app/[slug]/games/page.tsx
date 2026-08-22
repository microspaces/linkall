"use client";

import { useParams } from "next/navigation";
import { getLocoByRoute } from "@linkall/backend/convex/locos";
import { GameCatalog } from "@linkall/ui";

export default function LocoGamesPage() {
  const { slug, act } = useParams<{ slug: string; act?: string }>();
  const loco = getLocoByRoute(slug, act);
  if (!loco || loco.mode === "hub") return null;
  return <GameCatalog slug={loco.slug} />;
}
