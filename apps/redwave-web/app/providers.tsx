"use client";

import type { ReactNode } from "react";
import { brands } from "@linkall/brands";
import {
  AppShell,
  BrandProvider,
  ConvexAppProvider,
  CurrentUserProvider,
} from "@linkall/ui";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexAppProvider url={process.env.NEXT_PUBLIC_CONVEX_URL}>
      <BrandProvider brand={brands.redwave}>
        <CurrentUserProvider>
          <AppShell>{children}</AppShell>
        </CurrentUserProvider>
      </BrandProvider>
    </ConvexAppProvider>
  );
}
