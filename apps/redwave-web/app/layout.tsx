import type { Metadata } from "next";
import { brands } from "@linkall/brands";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: brands.redwave.name,
  description: brands.redwave.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
