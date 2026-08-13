"use client";

import { useParams } from "next/navigation";
import { GameCatalog } from "@linkall/ui";

export default function LocoGamesPage() {
  const { slug } = useParams<{ slug: string }>();
  return <GameCatalog slug={slug} />;
}
