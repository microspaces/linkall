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
  title: "Wrestle Loco | Hyperex Arena · Luxor Las Vegas",
  description:
    "Wrestle Loco — live pro wrestling chaos at Hyperex Arena, Luxor Las Vegas. Two teams. Crowd weapons. Fan refs. Phone-powered mayhem. Join the waitlist.",
};

export default function WrestleLocoLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${bebasNeue.variable} ${sora.variable}`}>
      {children}
    </div>
  );
}
