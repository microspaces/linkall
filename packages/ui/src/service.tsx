"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";
import {
  ORDER_STATUS_NEXT,
  PLACE_KINDS,
  type OrderStatus,
  type PlaceKind,
} from "@linkall/backend/convex/venueLogic";
import { useBrand } from "./brand-context";
import { useCurrentUser } from "./current-user";
import { EmptyState, Loading } from "./empty-state";
import { formatPrice } from "./format";
import { readGuestKey } from "./guest-key";

type Cart = Record<string, number>;

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  making: "Making",
  ready: "Ready",
  delivered: "Done",
  canceled: "Canceled",
};

const STATUS_TONE: Record<OrderStatus, string> = {
  new: "bg-amber-400 text-black",
  making: "bg-sky-400 text-black",
  ready: "bg-emerald-400 text-black",
  delivered: "bg-white/20 text-white",
  canceled: "bg-red-500/80 text-white",
};

function useGuestKey() {
  const [key, setKey] = useState("");
  useEffect(() => setKey(readGuestKey()), []);
  return key;
}

function cartCount(cart: Cart) {
  return Object.values(cart).reduce((n, q) => n + q, 0);
}

function cartLines(cart: Cart) {
  return Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([menuItemId, quantity]) => ({
      menuItemId: menuItemId as Id<"menuItems">,
      quantity,
    }));
}

export function GuestOrderSheet({
  screenId,
  onDone,
  kiosk = true,
}: {
  screenId?: Id<"screens">;
  onDone?: () => void;
  kiosk?: boolean;
}) {
  const guestKey = useGuestKey();
  const { userId } = useCurrentUser();
  const screenInfo = useQuery(
    api.venue.forScreen,
    screenId ? { screenId } : "skip",
  );
  const guest = useQuery(
    api.venue.guestView,
    guestKey ? { guestKey } : "skip",
  );
  const myOrders = useQuery(
    api.venue.myOrders,
    guestKey ? { guestKey } : "skip",
  );
  const claimPlace = useMutation(api.venue.claimPlace);
  const placeOrder = useMutation(api.venue.placeOrder);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const venueId = guest?.venue._id ?? screenInfo?.venue?._id;
  const flags = guest?.flags ?? screenInfo?.flags;
  const canOrder = screenId
    ? !!screenInfo?.canStealToOrder
    : !!guest?.canOrder;
  const boundPlace = screenInfo?.place;
  const claimed = guest?.claim;
  const placeId = boundPlace?._id ?? claimed?.placeId;
  const placeName = boundPlace?.name ?? claimed?.placeName;

  const menu = guest?.menu ?? [];
  const places = guest?.places ?? [];
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const item of menu) {
      if (!seen.includes(item.category)) seen.push(item.category);
    }
    return seen;
  }, [menu]);

  useEffect(() => {
    if (!venueId || !guestKey || !boundPlace || claimed?.placeId === boundPlace._id) {
      return;
    }
    void claimPlace({
      venueId,
      guestKey,
      placeId: boundPlace._id,
      userId,
    }).catch(() => undefined);
  }, [venueId, guestKey, boundPlace, claimed?.placeId, claimPlace, userId]);

  const setQty = (id: Id<"menuItems">, delta: number) => {
    setCart((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const submit = async () => {
    if (!venueId || !guestKey) return;
    setError(null);
    setBusy(true);
    try {
      await placeOrder({
        venueId,
        guestKey,
        placeId,
        screenId,
        userId,
        note: note.trim() || undefined,
        lines: cartLines(cart),
      });
      setCart({});
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send order");
    } finally {
      setBusy(false);
    }
  };

  const claimBy = async (opts: { placeId?: Id<"places">; code?: string }) => {
    if (!venueId || !guestKey) return;
    setError(null);
    setBusy(true);
    try {
      await claimPlace({
        venueId,
        guestKey,
        userId,
        ...opts,
      });
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not claim that place");
    } finally {
      setBusy(false);
    }
  };

  if (guest === undefined || (screenId && screenInfo === undefined)) {
    return kiosk ? (
      <div className="flex h-full items-center justify-center text-white/50">
        Loading…
      </div>
    ) : (
      <Loading />
    );
  }

  if (!guest || !venueId) {
    return kiosk ? (
      <p className="p-6 text-center text-white/60">No venue set up yet.</p>
    ) : (
      <EmptyState title="No venue yet" hint="Open Venue in the nav and create one." />
    );
  }

  if (!canOrder) {
    return (
      <div className={kiosk ? "p-8 text-center text-white/70" : "p-6"}>
        <p className="text-lg font-semibold">
          {screenId ? "Tablet ordering is off" : "Phone ordering is off"}
        </p>
        <p className="mt-2 text-sm opacity-70">
          Turn it on under Venue → Phones / Tablets.
        </p>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="mt-6 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold"
          >
            Back
          </button>
        )}
      </div>
    );
  }

  const shell = kiosk
    ? "flex h-full min-h-screen flex-col overflow-hidden bg-black text-white"
    : "space-y-4";

  return (
    <div className={shell}>
      <header
        className={
          kiosk
            ? "flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3"
            : "flex items-start justify-between gap-3"
        }
      >
        <div>
          <p className="text-xs uppercase tracking-wide text-white/45">
            {guest.venue.name}
          </p>
          <h1 className="text-xl font-semibold">
            {placeName ? placeName : "Where are you?"}
          </h1>
        </div>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20"
          >
            {screenId ? "Back to show" : "Done"}
          </button>
        )}
      </header>

      <div className={kiosk ? "flex-1 overflow-y-auto px-4 py-4" : ""}>
        {!placeId && (
          <section className="mb-6">
            <p className="text-sm text-white/60">
              Seat sticker, booth code, or pick a zone. The bar uses this to
              find you.
            </p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) void claimBy({ code });
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code (14, L, B2…)"
                className="min-w-0 flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-white/35"
              />
              <button
                type="submit"
                disabled={busy || !code.trim()}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Claim
              </button>
            </form>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {places.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => void claimBy({ placeId: p._id })}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                >
                  <span className="block text-sm font-semibold">{p.name}</span>
                  <span className="text-[11px] uppercase tracking-wide text-white/40">
                    {p.kind}
                    {p.code ? ` · ${p.code}` : ""}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {placeId && (
          <>
            <ChangePlace
              places={places}
              currentId={placeId}
              disabled={busy}
              onPick={(id) => void claimBy({ placeId: id })}
              kiosk={kiosk}
            />

            {categories.map((cat) => (
              <section key={cat} className="mb-5">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                  {cat}
                </h2>
                <div className="space-y-2">
                  {menu
                    .filter((item) => item.category === cat)
                    .map((item) => {
                      const qty = cart[item._id] ?? 0;
                      return (
                        <div
                          key={item._id}
                          className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-xs text-white/45">
                              {formatPrice(item.priceCents)}
                              {item.description ? ` · ${item.description}` : ""}
                              {!item.isAvailable ? " · 86’d" : ""}
                            </p>
                          </div>
                          {item.isAvailable ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setQty(item._id, -1)}
                                className="h-8 w-8 rounded-md bg-white/10 text-lg leading-none"
                                aria-label={`Remove ${item.name}`}
                              >
                                −
                              </button>
                              <span className="w-5 text-center text-sm tabular-nums">
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQty(item._id, 1)}
                                className="h-8 w-8 rounded-md bg-white/10 text-lg leading-none"
                                aria-label={`Add ${item.name}`}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-white/35">Off</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </section>
            ))}

            <label className="mb-4 block text-xs text-white/45">
              Note for the bar
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none"
                placeholder="Allergy, extra ice…"
              />
            </label>
          </>
        )}

        {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

        {(myOrders ?? []).length > 0 && (
          <section className="mb-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
              Your tickets
            </h2>
            <div className="space-y-2">
              {myOrders!.slice(0, 5).map((o) => (
                <div
                  key={o._id}
                  className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm"
                >
                  <span>
                    {o.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}
                  </span>
                  <span
                    className={
                      "rounded px-2 py-0.5 text-[11px] font-semibold " +
                      STATUS_TONE[o.status]
                    }
                  >
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {placeId && (
        <footer
          className={
            kiosk
              ? "border-t border-white/10 p-4"
              : "sticky bottom-0 bg-black/80 py-3"
          }
        >
          <button
            type="button"
            disabled={busy || cartCount(cart) === 0}
            onClick={() => void submit()}
            className="w-full rounded-xl bg-brand py-3 text-base font-semibold text-white disabled:opacity-40"
          >
            Send to bar
            {cartCount(cart) > 0 ? ` · ${cartCount(cart)}` : ""}
          </button>
        </footer>
      )}
    </div>
  );
}

function ChangePlace({
  places,
  currentId,
  onPick,
  disabled,
  kiosk,
}: {
  places: Array<{
    _id: Id<"places">;
    name: string;
    kind: PlaceKind;
    code?: string;
  }>;
  currentId: Id<"places">;
  onPick: (id: Id<"places">) => void;
  disabled: boolean;
  kiosk: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="mb-4 text-xs text-white/45 hover:text-white"
      >
        Change seat / booth
      </button>
    );
  }
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs text-white/45">Move this device</p>
      <div className={kiosk ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "flex flex-wrap gap-2"}>
        {places.map((p) => (
          <button
            key={p._id}
            type="button"
            onClick={() => {
              onPick(p._id);
              setOpen(false);
            }}
            className={
              "rounded-lg border px-3 py-2 text-left text-sm " +
              (p._id === currentId
                ? "border-brand bg-brand/30"
                : "border-white/15 bg-white/5")
            }
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BarTickets() {
  const brand = useBrand();
  const advance = useMutation(api.venue.advanceOrder);
  const setStatus = useMutation(api.venue.setOrderStatus);
  const [filter, setFilter] = useState<"open" | OrderStatus>("open");
  const filtered = useQuery(
    api.venue.barBoard,
    brand.features.venueService ? { status: filter } : "skip",
  );

  if (!brand.features.venueService) {
    return (
      <div className="flex h-full items-center justify-center bg-black p-6 text-white/60">
        Venue service is off for this brand.
      </div>
    );
  }

  const data = filtered;
  if (data === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-black text-white/50">
        Loading tickets…
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="flex h-full items-center justify-center bg-black p-6 text-center text-white/60">
        No venue yet. Open Venue and create one.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen flex-col bg-black text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/45">Bar</p>
          <h1 className="text-xl font-semibold">{data.venue.name}</h1>
        </div>
        <div className="flex flex-wrap gap-1">
          {(["open", "new", "making", "ready", "delivered"] as const).map(
            (s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={
                  "rounded-full px-3 py-1 text-xs font-semibold " +
                  (filter === s ? "bg-white text-black" : "bg-white/10")
                }
              >
                {s === "open" ? "Open" : STATUS_LABEL[s]}
              </button>
            ),
          )}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {data.orders.length === 0 ? (
          <p className="py-16 text-center text-white/40">No tickets.</p>
        ) : (
          <div className="mx-auto grid max-w-3xl gap-3">
            {data.orders.map((o) => {
              const next = ORDER_STATUS_NEXT[o.status];
              const total = o.lines.reduce(
                (n, l) => n + l.priceCents * l.quantity,
                0,
              );
              return (
                <article
                  key={o._id}
                  className="rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{o.placeName}</p>
                      <p className="text-xs text-white/40">
                        {new Date(o.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <span
                      className={
                        "rounded px-2 py-0.5 text-xs font-semibold " +
                        STATUS_TONE[o.status]
                      }
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">
                    {o.lines.map((l) => (
                      <li key={l._id}>
                        {l.quantity}× {l.name}
                        <span className="text-white/40">
                          {" "}
                          · {formatPrice(l.priceCents * l.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {o.note && (
                    <p className="mt-2 text-sm text-amber-200">Note: {o.note}</p>
                  )}
                  <p className="mt-2 text-sm font-semibold">
                    {formatPrice(total)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {next && (
                      <button
                        type="button"
                        onClick={() => void advance({ orderId: o._id })}
                        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold"
                      >
                        Mark {STATUS_LABEL[next]}
                      </button>
                    )}
                    {o.status !== "canceled" && o.status !== "delivered" && (
                      <button
                        type="button"
                        onClick={() =>
                          void setStatus({
                            orderId: o._id,
                            status: "canceled",
                          })
                        }
                        className="rounded-lg bg-white/10 px-4 py-2 text-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function VenueSettings() {
  const brand = useBrand();
  const { userId } = useCurrentUser();
  const data = useQuery(
    api.venue.getDefault,
    brand.features.venueService ? {} : "skip",
  );
  const layouts = useQuery(
    api.designer.listLayouts,
    brand.features.venueService ? {} : "skip",
  );
  const screens = useQuery(
    api.designer.listScreens,
    brand.features.venueService ? {} : "skip",
  );
  const ensure = useMutation(api.venue.ensureVenue);
  const setFlags = useMutation(api.venue.setFlags);
  const updateVenue = useMutation(api.venue.updateVenue);
  const upsertPlace = useMutation(api.venue.upsertPlace);
  const removePlace = useMutation(api.venue.removePlace);
  const upsertMenuItem = useMutation(api.venue.upsertMenuItem);
  const removeMenuItem = useMutation(api.venue.removeMenuItem);

  const [name, setName] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [placeKind, setPlaceKind] = useState<PlaceKind>("seat");
  const [placeCode, setPlaceCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("8");
  const [itemCat, setItemCat] = useState("Drinks");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.name) setName(data.name);
  }, [data?.name]);

  if (!brand.features.venueService) {
    return (
      <EmptyState
        title="Venue service is off for this brand"
        hint="This brand does not include seats, booths, or bar tickets."
      />
    );
  }

  if (data === undefined) return <Loading />;

  if (!data) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Venue</h1>
        <p className="mt-2 text-sm text-gray-600">
          Seats, booths, phones and tablets — not tied to a show. Create a
          venue, then toggle phone vs tablet features per night.
        </p>
        <button
          type="button"
          disabled={!userId}
          onClick={() => userId && void ensure({ ownerId: userId })}
          className="mt-6 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Create venue
        </button>
      </div>
    );
  }

  const flags = data.flags;
  const patchFlags = (next: Partial<typeof flags>) => {
    void setFlags({ venueId: data._id, ...flags, ...next });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Venue</h1>
        <p className="mt-1 text-sm text-gray-600">
          Works on any night. Phones and tablets are separate switches.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <a href="/order" className="rounded-md bg-brand px-3 py-1.5 font-semibold text-white">
            Guest phone →
          </a>
          <a href="/bar" className="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-800">
            Bar iPad →
          </a>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold text-gray-900">Night</h2>
        <label className="mt-3 block text-xs font-semibold uppercase text-gray-400">
          Name
        </label>
        <div className="mt-1 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() =>
              void updateVenue({
                venueId: data._id,
                name,
                ...flags,
              })
            }
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Save
          </button>
        </div>
        {layouts && layouts.length > 0 && (
          <>
            <label className="mt-3 block text-xs font-semibold uppercase text-gray-400">
              Layout
            </label>
            <select
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={data.layoutId ?? ""}
              onChange={(e) =>
                void updateVenue({
                  venueId: data._id,
                  name: data.name,
                  layoutId: (e.target.value || null) as Id<"layouts"> | null,
                  ...flags,
                })
              }
            >
              <option value="">None</option>
              {layouts.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                </option>
              ))}
            </select>
          </>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-gray-900">Phones</h2>
            <p className="text-xs text-gray-500">
              Guest phones at seats — Comedy Loco theater, GA, BYOD.
            </p>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() =>
                patchFlags({ phoneOrdering: true, phoneAsScreen: true })
              }
              className="rounded-md bg-gray-900 px-2 py-1 text-xs font-semibold text-white"
            >
              On
            </button>
            <button
              type="button"
              onClick={() =>
                patchFlags({ phoneOrdering: false, phoneAsScreen: false })
              }
              className="rounded-md border px-2 py-1 text-xs"
            >
              Off
            </button>
          </div>
        </div>
        <FlagRow
          label="Order from seats"
          checked={flags.phoneOrdering}
          onChange={(v) => patchFlags({ phoneOrdering: v })}
        />
        <FlagRow
          label="Join as a screen"
          checked={flags.phoneAsScreen}
          onChange={(v) => patchFlags({ phoneAsScreen: v })}
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-gray-900">Tablets</h2>
            <p className="text-xs text-gray-500">
              Booth / table outputs. They play the show unless someone is
              ordering.
            </p>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() =>
                patchFlags({ tabletOrdering: true, tabletAsScreen: true })
              }
              className="rounded-md bg-gray-900 px-2 py-1 text-xs font-semibold text-white"
            >
              On
            </button>
            <button
              type="button"
              onClick={() =>
                patchFlags({ tabletOrdering: false, tabletAsScreen: false })
              }
              className="rounded-md border px-2 py-1 text-xs"
            >
              Off
            </button>
          </div>
        </div>
        <FlagRow
          label="Play the show"
          checked={flags.tabletAsScreen}
          onChange={(v) => patchFlags({ tabletAsScreen: v })}
        />
        <FlagRow
          label="Take orders"
          checked={flags.tabletOrdering}
          onChange={(v) => patchFlags({ tabletOrdering: v })}
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold text-gray-900">Places</h2>
        <p className="text-xs text-gray-500">
          Service locations, independent of screens. Code is what guests type
          from a sticker or QR.
        </p>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            void upsertPlace({
              venueId: data._id,
              name: placeName,
              kind: placeKind,
              code: placeCode || undefined,
            })
              .then(() => {
                setPlaceName("");
                setPlaceCode("");
              })
              .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "Could not add"),
              );
          }}
        >
          <input
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            placeholder="Seat 14"
            className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
            required
          />
          <select
            value={placeKind}
            onChange={(e) => setPlaceKind(e.target.value as PlaceKind)}
            className="rounded-md border px-2 py-2 text-sm"
          >
            {PLACE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            value={placeCode}
            onChange={(e) => setPlaceCode(e.target.value)}
            placeholder="Code"
            className="w-24 rounded-md border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Add
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <ul className="mt-3 divide-y">
          {data.places.map((p) => (
            <li
              key={p._id}
              className="flex flex-wrap items-center gap-2 py-2 text-sm"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-gray-400">
                {p.kind}
                {p.code ? ` · ${p.code}` : ""}
              </span>
              {screens && screens.length > 0 && (
                <select
                  className="ml-auto rounded border px-2 py-1 text-xs"
                  value={p.screenId ?? ""}
                  onChange={(e) =>
                    void upsertPlace({
                      placeId: p._id,
                      venueId: data._id,
                      name: p.name,
                      kind: p.kind,
                      code: p.code,
                      screenId: (e.target.value ||
                        null) as Id<"screens"> | null,
                    })
                  }
                >
                  <option value="">No tablet</option>
                  {screens.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.layoutName} / {s.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => void removePlace({ placeId: p._id })}
                className="text-xs text-red-500"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold text-gray-900">Menu</h2>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const dollars = Number(itemPrice);
            if (Number.isNaN(dollars)) return;
            void upsertMenuItem({
              venueId: data._id,
              name: itemName,
              priceCents: Math.round(dollars * 100),
              category: itemCat,
              isAvailable: true,
            }).then(() => {
              setItemName("");
            });
          }}
        >
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="House beer"
            className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
            required
          />
          <input
            value={itemCat}
            onChange={(e) => setItemCat(e.target.value)}
            className="w-28 rounded-md border px-3 py-2 text-sm"
          />
          <input
            value={itemPrice}
            onChange={(e) => setItemPrice(e.target.value)}
            className="w-20 rounded-md border px-3 py-2 text-sm"
            inputMode="decimal"
          />
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Add
          </button>
        </form>
        <ul className="mt-3 divide-y">
          {data.menu.map((item) => (
            <li
              key={item._id}
              className="flex items-center gap-2 py-2 text-sm"
            >
              <span className="font-medium">{item.name}</span>
              <span className="text-gray-400">
                {item.category} · {formatPrice(item.priceCents)}
              </span>
              <label className="ml-auto flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={item.isAvailable}
                  onChange={(e) =>
                    void upsertMenuItem({
                      menuItemId: item._id,
                      venueId: data._id,
                      name: item.name,
                      description: item.description,
                      priceCents: item.priceCents,
                      category: item.category,
                      isAvailable: e.target.checked,
                    })
                  }
                />
                Up
              </label>
              <button
                type="button"
                onClick={() => void removeMenuItem({ menuItemId: item._id })}
                className="text-xs text-red-500"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FlagRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
