"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import { useBrand } from "./brand-context";
import { ScreenOutput } from "./player";
import { GuestOrderSheet } from "./service";
import { readGuestKey } from "./guest-key";

/**
 * Guest phone night: claim a place, optionally ride the live show as the
 * audience-phone canvas, steal locally to order. Not show-specific — flags
 * on the venue turn phone features off.
 */
export function GuestNight() {
  const brand = useBrand();
  const [guestKey, setGuestKey] = useState("");
  const [ordering, setOrdering] = useState(false);
  useEffect(() => setGuestKey(readGuestKey()), []);
  const guest = useQuery(
    api.venue.guestView,
    guestKey && brand.features.venueService ? { guestKey } : "skip",
  );

  if (!brand.features.venueService) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6 text-center text-white/70">
        Venue service is off for this brand.
      </div>
    );
  }

  if (!guestKey || guest === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white/50">
        Loading…
      </div>
    );
  }

  if (!guest) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6 text-center text-white/70">
        No venue set up yet.
      </div>
    );
  }

  if (!guest.phonesOn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-8 text-center text-white">
        <p className="text-xl font-semibold">Phone features are off</p>
        <p className="mt-2 max-w-sm text-sm text-white/55">
          Ordering from seats and joining as a screen are both off for this
          venue. Staff can turn them on under Venue.
        </p>
      </div>
    );
  }

  const watching =
    guest.canJoinShow && !!guest.phoneScreenId && !ordering;

  if (watching) {
    return (
      <div className="relative min-h-screen bg-black">
        <ScreenOutput screenId={guest.phoneScreenId!} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4">
          <p className="pointer-events-none rounded-full bg-black/60 px-3 py-1 text-xs text-white/80">
            {guest.claim?.placeName}
          </p>
          {guest.canOrder && (
            <button
              type="button"
              onClick={() => setOrdering(true)}
              className="pointer-events-auto rounded-full bg-brand px-8 py-3 text-base font-semibold text-white shadow-lg"
            >
              Order
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto min-h-screen max-w-lg">
        <GuestOrderSheet
          kiosk
          onDone={
            guest.canJoinShow ? () => setOrdering(false) : undefined
          }
        />
      </div>
    </div>
  );
}
