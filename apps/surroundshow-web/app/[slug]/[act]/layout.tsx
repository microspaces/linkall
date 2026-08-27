import type { Metadata } from "next";
import type { ReactNode } from "react";
import { locoLayoutTitle } from "@linkall/backend/convex/locos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; act: string }>;
}): Promise<Metadata> {
  const { slug, act } = await params;
  return { title: locoLayoutTitle(slug, act) };
}

export default function LocoActLayout({ children }: { children: ReactNode }) {
  return children;
}
