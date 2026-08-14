"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useCurrentUser } from "./current-user";
import { Landing } from "./landing";
import { PostComposer } from "./feed";
import { Loading } from "./empty-state";
import { Avatar } from "./avatar";
import { timeAgo } from "./format";

/**
 * Legacy Home / Community toggle (Surroundshow Index.cshtml rw-two-pane).
 * Authenticated users land on Community; guests see Home.
 */

type FeedPost = FunctionReturnType<typeof api.posts.userFeed>[number];

function CommunityPost({ post }: { post: FeedPost }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <Avatar name={post.author?.name ?? "?"} src={post.author?.avatarUrl} />
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {post.author?.name ?? "Unknown"}
            {post.isSolution && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                ✓ Solution
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400">{timeAgo(post._creationTime)}</p>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800">
        {post.content}
      </p>
      <p className="mt-2 text-xs text-gray-400">▲ {post.upvotes}</p>
    </article>
  );
}

function CommunityPane() {
  const { userId } = useCurrentUser();
  const posts = useQuery(
    api.posts.userFeed,
    userId ? { userId } : "skip",
  );

  if (!userId)
    return (
      <p className="text-sm text-gray-500">Sign in to see your community feed.</p>
    );
  if (posts === undefined) return <Loading />;

  return (
    <div className="space-y-4">
      <PostComposer placeholder="To comment on a solution, go there first. Or on your timeline, comment here." />
      {posts.length === 0 ? (
        <p className="text-sm text-gray-500">No posts in your groups yet.</p>
      ) : (
        posts.map((post) => <CommunityPost key={post._id} post={post} />)
      )}
    </div>
  );
}

export function HomeCommunity() {
  const { userId } = useCurrentUser();
  const [tab, setTab] = useState<"home" | "community">(
    userId ? "community" : "home",
  );

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("home")}
          className={
            "rounded-md border px-4 py-1.5 text-sm font-semibold transition " +
            (tab === "home"
              ? "border-gray-600 bg-gray-700 text-white"
              : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50")
          }
        >
          Home
        </button>
        <button
          onClick={() => setTab("community")}
          className={
            "rounded-md border px-4 py-1.5 text-sm font-semibold transition " +
            (tab === "community"
              ? "border-gray-600 bg-gray-700 text-white"
              : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50")
          }
        >
          Community
        </button>
      </div>

      <div className="overflow-hidden">
        {tab === "home" ? <Landing /> : <CommunityPane />}
      </div>
    </div>
  );
}
