"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import { useCurrentUser } from "./current-user";
import { EmptyState, Loading } from "./empty-state";
import { formatDate, formatPrice } from "./format";

export function EventList() {
  const { userId } = useCurrentUser();
  const events = useQuery(api.events.list);
  const myTickets = useQuery(api.events.myTickets, userId ? { userId } : "skip");
  const buyTicket = useMutation(api.events.buyTicket);

  if (events === undefined) return <Loading />;

  const ticketCountFor = (eventId: string) =>
    myTickets
      ?.filter((t) => t.eventId === eventId)
      .reduce((sum, t) => sum + t.quantity, 0) ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Events & Tickets</h1>
      {events.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No events scheduled" />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {events.map((event) => {
            const left = event.capacity - event.ticketsSold;
            const mine = ticketCountFor(event._id);
            return (
              <div
                key={event._id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-5"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900">{event.title}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {event.description}
                  </p>
                  <p className="mt-2 text-sm text-gray-400">
                    {formatDate(event.startsAt)} · {event.venue}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">
                    {formatPrice(event.priceCents)}
                  </p>
                  <p
                    className={
                      "text-xs " +
                      (left <= 10 ? "text-red-500" : "text-gray-400")
                    }
                  >
                    {left <= 0 ? "Sold out" : `${left} left`}
                  </p>
                  {mine > 0 && (
                    <p className="mt-1 text-xs font-medium text-brand">
                      You have {mine} ticket{mine === 1 ? "" : "s"}
                    </p>
                  )}
                  {userId && left > 0 && (
                    <button
                      onClick={() =>
                        buyTicket({ eventId: event._id, userId, quantity: 1 })
                      }
                      className="mt-2 rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
                    >
                      Buy ticket
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
