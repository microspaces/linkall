"use client";

import { useMemo, type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";

/**
 * Convex + Convex Auth provider. Use `variant="nextjs"` in the Next.js
 * apps (pairs with ConvexAuthNextjsServerProvider + middleware). Mobile
 * should use ConvexAuthProvider directly so it can pass AsyncStorage.
 */
export function ConvexAppProvider({
  url,
  children,
  variant = "react",
}: {
  url: string | undefined;
  children: ReactNode;
  variant?: "react" | "nextjs";
}) {
  const client = useMemo(
    () => (url ? new ConvexReactClient(url) : null),
    [url],
  );

  if (!client) {
    return <BackendNotConfigured />;
  }

  if (variant === "nextjs") {
    return (
      <ConvexAuthNextjsProvider client={client}>
        {children}
      </ConvexAuthNextjsProvider>
    );
  }

  return <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>;
}

export function BackendNotConfigured() {
  return (
    <div className="mx-auto mt-24 max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-8 text-amber-900">
      <h1 className="text-lg font-semibold">Backend not configured</h1>
      <p className="mt-2 text-sm leading-6">
        Set{" "}
        <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_CONVEX_URL</code>{" "}
        in this app&apos;s{" "}
        <code className="rounded bg-amber-100 px-1">.env.local</code> to the URL
        of this brand&apos;s Convex deployment, then restart the dev server. See
        the repository README for the full setup walkthrough.
      </p>
    </div>
  );
}
