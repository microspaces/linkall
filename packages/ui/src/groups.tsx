"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";
import { Avatar } from "./avatar";
import { useCurrentUser } from "./current-user";
import { EmptyState, Loading } from "./empty-state";
import { Feed } from "./feed";

const KIND_LABEL: Record<string, string> = {
  public: "Public",
  private: "Private",
  state: "State hub",
  county: "County hub",
};

export function GroupList({
  kind,
  title = "Groups",
}: {
  kind?: "public" | "private" | "state" | "county";
  title?: string;
}) {
  const { userId } = useCurrentUser();
  const groups = useQuery(api.groups.list, { userId, kind });
  const join = useMutation(api.groups.join);
  const leave = useMutation(api.groups.leave);

  if (groups === undefined) return <Loading />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {groups.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No groups yet" />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div
              key={group._id}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="flex items-start justify-between">
                <Link
                  href={`/groups/${group._id}`}
                  className="font-semibold text-gray-900 hover:text-brand"
                >
                  {group.name}
                </Link>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {KIND_LABEL[group.kind]}
                </span>
              </div>
              <p className="mt-2 flex-1 text-sm text-gray-500">
                {group.description}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                </span>
                {userId && (
                  <button
                    onClick={() =>
                      group.isMember
                        ? leave({ groupId: group._id, userId })
                        : join({ groupId: group._id, userId })
                    }
                    className={
                      "rounded-md px-3 py-1 text-sm font-medium " +
                      (group.isMember
                        ? "border border-gray-300 text-gray-600 hover:bg-gray-50"
                        : "bg-brand text-white hover:bg-brand-dark")
                    }
                  >
                    {group.isMember ? "Leave" : "Join"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GroupDetail({ groupId }: { groupId: Id<"groups"> }) {
  const { userId } = useCurrentUser();
  const group = useQuery(api.groups.get, { groupId, userId });
  const members = useQuery(api.groups.members, { groupId });
  const join = useMutation(api.groups.join);
  const leave = useMutation(api.groups.leave);

  if (group === undefined) return <Loading />;
  if (group === null) return <EmptyState title="Group not found" hint=" " />;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
              <p className="mt-1 text-sm text-gray-500">{group.description}</p>
            </div>
            {userId && (
              <button
                onClick={() =>
                  group.isMember
                    ? leave({ groupId, userId })
                    : join({ groupId, userId })
                }
                className={
                  "shrink-0 rounded-md px-4 py-1.5 text-sm font-medium " +
                  (group.isMember
                    ? "border border-gray-300 text-gray-600 hover:bg-gray-50"
                    : "bg-brand text-white hover:bg-brand-dark")
                }
              >
                {group.isMember ? "Leave group" : "Join group"}
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            {KIND_LABEL[group.kind]} · {group.memberCount} members
          </p>
        </div>

        <h2 className="mt-8 text-lg font-semibold text-gray-900">Group wall</h2>
        <div className="mt-4">
          <Feed groupId={groupId} />
        </div>
      </div>

      <aside>
        <h2 className="text-lg font-semibold text-gray-900">Members</h2>
        <div className="mt-4 space-y-3">
          {members?.map((m) => (
            <div key={m._id} className="flex items-center gap-3">
              <Avatar name={m.user!.name} src={m.user!.avatarUrl} size={32} />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {m.user!.name}
                  {m.isAdmin && (
                    <span className="ml-2 rounded bg-brand-light px-1.5 py-0.5 text-xs text-brand-dark">
                      admin
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400">@{m.user!.handle}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
