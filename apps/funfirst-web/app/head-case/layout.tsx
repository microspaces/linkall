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
  title: { absolute: "HeadCase | Live Comedy With a TV Head" },
  description:
    "HeadCase — the comedian with a 40-inch TV for a head. Live face-filter gags, 855 scripted bits, and a crowd that holds the remote. Join the list.",
};

export default function HeadCaseLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${bebasNeue.variable} ${sora.variable}`}>
      {children}
    </div>
  );
}
