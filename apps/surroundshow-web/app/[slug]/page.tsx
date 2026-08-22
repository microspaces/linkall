"use client";

import { useParams } from "next/navigation";
import { LocoHome } from "@linkall/ui";

export default function LocoSlugPage() {
  const { slug, act } = useParams<{ slug: string; act?: string }>();
  return <LocoHome slug={act ?? slug} parentSlug={act ? slug : undefined} />;
}
