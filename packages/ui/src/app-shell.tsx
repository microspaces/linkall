"use client";

import type { ReactNode } from "react";
import { SocialShell } from "./social-shell";

/** @deprecated Use SocialShell directly — kept as alias for existing imports. */
export function AppShell({ children }: { children: ReactNode }) {
  return <SocialShell>{children}</SocialShell>;
}

export { SocialShell } from "./social-shell";
