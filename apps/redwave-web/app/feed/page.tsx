"use client";

import { Feed } from "@linkall/ui";

export default function FeedPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">News & Discussion</h1>
      <Feed />
    </div>
  );
}
