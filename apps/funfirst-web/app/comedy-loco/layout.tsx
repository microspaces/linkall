import type { Metadata } from "next";
import { Bebas_Neue, Sora } from "next/font/google";
import type { ReactNode } from "react";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: { absolute: "Comedy Loco | Location TBA Las Vegas" },
  description:
    "Comedy Loco - live competitive comedy in Las Vegas. 2 teams, Celebrity Superstars, cheers choose the winner. Fast comedy, games, points that count. Join the waitlist.",
};

export default function ComedyLocoLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${bebasNeue.variable} ${sora.variable}`}>
      {children}
    </div>
  );
}
