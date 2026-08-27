import type { ReactNode } from "react";
export const metadata = { title: "Bar" };
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
