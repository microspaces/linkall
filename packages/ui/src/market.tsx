"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import { useCurrentUser } from "./current-user";
import { EmptyState, Loading } from "./empty-state";
import { formatPrice } from "./format";

export function Marketplace() {
  const { userId } = useCurrentUser();
  const products = useQuery(api.products.list, {});
  const cart = useQuery(api.products.cart, userId ? { userId } : "skip");
  const addToCart = useMutation(api.products.addToCart);
  const removeFromCart = useMutation(api.products.removeFromCart);

  if (products === undefined) return <Loading />;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Marketplace</h1>
        {products.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No products yet" />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {products.map((product) => (
              <div
                key={product._id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                {product.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-40 w-full object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900">
                      {product.name}
                    </h3>
                    {product.holiday && (
                      <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand-dark">
                        {product.holiday}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {product.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-semibold text-gray-900">
                      {formatPrice(product.priceCents)}
                    </span>
                    {userId && (
                      <button
                        onClick={() =>
                          addToCart({ userId, productId: product._id })
                        }
                        className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
                      >
                        Add to cart
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <aside>
        <h2 className="text-lg font-semibold text-gray-900">Your cart</h2>
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          {!cart || cart.items.length === 0 ? (
            <p className="text-sm text-gray-400">Cart is empty.</p>
          ) : (
            <>
              <ul className="space-y-3">
                {cart.items.map((item) => (
                  <li
                    key={item._id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-gray-700">
                      {item.product!.name}{" "}
                      <span className="text-gray-400">×{item.quantity}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-gray-500">
                        {formatPrice(item.product!.priceCents * item.quantity)}
                      </span>
                      {userId && (
                        <button
                          onClick={() =>
                            removeFromCart({
                              userId,
                              productId: item.productId,
                            })
                          }
                          className="text-gray-300 hover:text-red-500"
                          aria-label="Remove"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-sm font-medium text-gray-600">Total</span>
                <span className="font-bold text-gray-900">
                  {formatPrice(cart.totalCents)}
                </span>
              </div>
              <button className="mt-3 w-full rounded-md bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                Checkout (demo)
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
