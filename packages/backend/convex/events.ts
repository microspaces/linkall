import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("events")
      .withIndex("by_startsAt")
      .order("asc")
      .collect();
  },
});

export const get = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    return await ctx.db.get(eventId);
  },
});

export const myTickets = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return await Promise.all(
      tickets.map(async (t) => ({
        ...t,
        event: await ctx.db.get(t.eventId),
      })),
    );
  },
});

export const buyTicket = mutation({
  args: {
    eventId: v.id("events"),
    userId: v.id("users"),
    quantity: v.number(),
  },
  handler: async (ctx, { eventId, userId, quantity }) => {
    if (quantity < 1) throw new Error("Quantity must be at least 1");
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error("Event not found");
    if (event.ticketsSold + quantity > event.capacity) {
      throw new Error("Not enough tickets left");
    }
    await ctx.db.insert("tickets", { eventId, userId, quantity });
    await ctx.db.patch(eventId, { ticketsSold: event.ticketsSold + quantity });
    await ctx.db.insert("notifications", {
      userId,
      message: `You got ${quantity} ticket(s) for ${event.title}`,
      isRead: false,
    });
  },
});
