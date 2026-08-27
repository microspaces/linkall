import type { Metadata } from "next";
import type { ReactNode } from "react";

const LABELS: Record<string, string> = {
  live: "Live",
  vote: "Vote",
  score: "Score",
  instructions: "Instructions",
  "box-score": "Box Score",
  rotation: "Score Rotation",
  winner: "Winner",
  games: "Games",
  introduction: "Introduction",
  suggestions: "Suggestions",
  crowd: "Crowd",
  punishment: "Punishment",
  ring: "Ring",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string }>;
}): Promise<Metadata> {
  const { kind } = await params;
  return { title: LABELS[kind] ?? "Overlay" };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
