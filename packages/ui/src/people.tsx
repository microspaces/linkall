"use client";

import { useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import { Avatar } from "./avatar";
import { EmptyState, Loading } from "./empty-state";

const TIER_STYLE: Record<string, string> = {
  free: "bg-gray-100 text-gray-600",
  silver: "bg-slate-200 text-slate-700",
  gold: "bg-amber-100 text-amber-700",
  admin: "bg-brand-light text-brand-dark",
};

export function PeopleDirectory() {
  const users = useQuery(api.users.list);

  if (users === undefined) return <Loading />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">People</h1>
      {users.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No people yet" />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <div
              key={user._id}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="flex items-center gap-3">
                <Avatar name={user.name} src={user.avatarUrl} size={44} />
                <div>
                  <p className="font-semibold text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-400">@{user.handle}</p>
                </div>
                <span
                  className={
                    "ml-auto rounded-full px-2 py-0.5 text-xs font-medium " +
                    TIER_STYLE[user.tier]
                  }
                >
                  {user.tier}
                </span>
              </div>
              {user.bio && (
                <p className="mt-3 text-sm text-gray-500">{user.bio}</p>
              )}
              {user.state && (
                <p className="mt-2 text-xs text-gray-400">
                  {user.county ? `${user.county} County, ` : ""}
                  {user.state}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
