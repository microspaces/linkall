import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "FunFirst — live show platform",
  description:
    "FunFirst is the live-show platform behind Battle Loco, Wrestle Loco, Comedy Loco, and HeadCase. Four distinct experiences. One umbrella. All built for the crowd that refuses to sit still.",
  openGraph: {
    title: "FunFirst — live show platform",
    description:
      "FunFirst is the live-show platform behind Battle Loco, Wrestle Loco, Comedy Loco, and HeadCase. Four distinct experiences. One umbrella. All built for the crowd that refuses to sit still.",
    images: [
      {
        url: "/fun-first/og.jpg",
        width: 1200,
        height: 630,
        alt: "FunFirst — live show platform",
      },
    ],
  },
};

export default function FunFirstLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
