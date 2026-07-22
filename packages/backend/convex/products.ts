import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { holiday: v.optional(v.string()) },
  handler: async (ctx, { holiday }) => {
    if (holiday) {
      return await ctx.db
        .query("products")
        .withIndex("by_holiday", (q) => q.eq("holiday", holiday))
        .collect();
    }
    return await ctx.db.query("products").collect();
  },
});

export const cart = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const items = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const withProducts = await Promise.all(
      items.map(async (item) => ({
        ...item,
        product: await ctx.db.get(item.productId),
      })),
    );
    const valid = withProducts.filter((i) => i.product !== null);
    const totalCents = valid.reduce(
      (sum, i) => sum + (i.product!.priceCents ?? 0) * i.quantity,
      0,
    );
    return { items: valid, totalCents };
  },
});

export const addToCart = mutation({
  args: { userId: v.id("users"), productId: v.id("products") },
  handler: async (ctx, { userId, productId }) => {
    const existing = await ctx.db
      .query("cartItems")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", productId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { quantity: existing.quantity + 1 });
    } else {
      await ctx.db.insert("cartItems", { userId, productId, quantity: 1 });
    }
  },
});

export const removeFromCart = mutation({
  args: { userId: v.id("users"), productId: v.id("products") },
  handler: async (ctx, { userId, productId }) => {
    const existing = await ctx.db
      .query("cartItems")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", productId),
      )
      .unique();
    if (!existing) return;
    if (existing.quantity > 1) {
      await ctx.db.patch(existing._id, { quantity: existing.quantity - 1 });
    } else {
      await ctx.db.delete(existing._id);
    }
  },
});
