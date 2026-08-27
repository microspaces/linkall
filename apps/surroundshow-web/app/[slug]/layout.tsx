import type { Metadata } from "next";
import type { ReactNode } from "react";
import { locoLayoutTitle } from "@linkall/backend/convex/locos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: locoLayoutTitle(slug) };
}

export default function LocoLayout({ children }: { children: ReactNode }) {
  return children;
}
