"use client";

import { LocoHome } from "@linkall/ui";

export default function WeddingLocoPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Wedding Loco</h1>
        <p className="mt-1 text-sm text-gray-500">
          Two separate set lists — chapel ceremony, then DJ reception.
        </p>
      </div>
      <LocoHome slug="wedding-ceremony" />
      <LocoHome slug="wedding-reception" />
    </div>
  );
}
