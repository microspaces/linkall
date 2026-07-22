"use client";

import { useMemo, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

/**
 * ConvexProvider that degrades gracefully when NEXT_PUBLIC_CONVEX_URL isn't
 * set yet, showing setup instructions instead of crashing on first run.
 */
export function ConvexAppProvider({
  url,
  children,
}: {
  url: string | undefined;
  children: ReactNode;
}) {
  const client = useMemo(
    () => (url ? new ConvexReactClient(url) : null),
    [url],
  );

  if (!client) {
    return (
      <div className="mx-auto mt-24 max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-8 text-amber-900">
        <h1 className="text-lg font-semibold">Backend not configured</h1>
        <p className="mt-2 text-sm leading-6">
          Set <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_CONVEX_URL</code> in
          this app&apos;s <code className="rounded bg-amber-100 px-1">.env.local</code> to the
          URL of this brand&apos;s Convex deployment, then restart the dev server.
          See the repository README for the full setup walkthrough.
        </p>
      </div>
    );
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
