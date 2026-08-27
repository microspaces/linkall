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
  title: { absolute: "Battle Loco | Hyperex Arena · Luxor Las Vegas" },
  description:
    "Battle Loco — the live competitive show at Hyperex Arena, Luxor Las Vegas. YouTubers, celebrities, and athletes. Games, chaos, crowd votes. Join the waitlist.",
};

export default function BattleLocoLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${bebasNeue.variable} ${sora.variable}`}>
      {children}
    </div>
  );
}
