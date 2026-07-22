"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loading, ShowList } from "@linkall/ui";

function Shows() {
  const params = useSearchParams();
  return <ShowList tag={params.get("tag") ?? undefined} />;
}

export default function ShowsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Shows />
    </Suspense>
  );
}
