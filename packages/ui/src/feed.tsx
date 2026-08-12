"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Doc, Id } from "@linkall/backend/convex/_generated/dataModel";
import { Avatar } from "./avatar";
import { useBrand } from "./brand-context";
import { useCurrentUser } from "./current-user";
import { EmptyState, Loading } from "./empty-state";
import { timeAgo } from "./format";

type FeedPost = Doc<"posts"> & {
  author: Doc<"users"> | null;
  hasUpvoted: boolean;
};

export function PostComposer({
  groupId,
  placeholder,
}: {
  groupId?: Id<"groups">;
  placeholder?: string;
}) {
  const brand = useBrand();
  const { user, userId } = useCurrentUser();
  const createPost = useMutation(api.posts.create);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"news" | "discussion">(
    brand.features.solutions ? "news" : "discussion",
  );
  const [busy, setBusy] = useState(false);

  if (!userId) return null;

  const newsMode = brand.features.solutions;
  const hint =
    placeholder ??
    (newsMode
      ? kind === "news"
        ? "Post a news item for your groups…"
        : "Start a discussion…"
      : "Share something with the community…");

  const submit = async () => {
    if (!content.trim()) return;
    if (newsMode && kind === "news" && !title.trim()) return;
    setBusy(true);
    try {
      await createPost({
        authorId: userId,
        content,
        groupId,
        kind: newsMode ? kind : undefined,
        title: newsMode && kind === "news" ? title : undefined,
      });
      setContent("");
      setTitle("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4">
      {user && <Avatar name={user.name} src={user.avatarUrl} />}
      <div className="flex-1">
        {newsMode && (
          <div className="mb-2 flex gap-1">
            {(["news", "discussion"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={
                  "rounded-full px-3 py-0.5 text-xs font-semibold capitalize " +
                  (kind === k
                    ? "bg-brand text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200")
                }
              >
                {k}
              </button>
            ))}
          </div>
        )}
        {newsMode && kind === "news" && (
          <input
            className="mb-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm font-semibold focus:border-brand focus:outline-none"
            placeholder="Headline"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
        <textarea
          className="w-full resize-none rounded-md border border-gray-200 p-2 text-sm focus:border-brand focus:outline-none"
          rows={2}
          placeholder={hint}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={submit}
            disabled={
              busy ||
              !content.trim() ||
              (newsMode && kind === "news" && !title.trim())
            }
            className="rounded-md bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40"
          >
            {newsMode && kind === "news" ? "Post news" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostCard({ post }: { post: FeedPost }) {
  const { userId } = useCurrentUser();
  const toggleUpvote = useMutation(api.posts.toggleUpvote);
  const createPost = useMutation(api.posts.create);
  const [showReplies, setShowReplies] = useState(false);
  const [reply, setReply] = useState("");
  const replies = useQuery(
    api.posts.replies,
    showReplies ? { postId: post._id, userId } : "skip",
  );

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <Avatar name={post.author?.name ?? "?"} src={post.author?.avatarUrl} />
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {post.author?.name ?? "Unknown"}
            <span className="ml-2 font-normal text-gray-400">
              @{post.author?.handle}
            </span>
            {post.kind === "news" && (
              <span className="ml-2 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-dark">
                News
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400">{timeAgo(post._creationTime)}</p>
        </div>
      </div>
      {post.title && (
        <h3 className="mt-3 font-semibold text-gray-900">{post.title}</h3>
      )}
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800">
        {post.content}
      </p>
      <div className="mt-3 flex gap-4 text-sm">
        <button
          onClick={() => userId && toggleUpvote({ postId: post._id, userId })}
          className={
            "flex items-center gap-1 " +
            (post.hasUpvoted
              ? "font-semibold text-brand"
              : "text-gray-500 hover:text-brand")
          }
        >
          ▲ {post.upvotes}
        </button>
        <button
          onClick={() => setShowReplies((s) => !s)}
          className="text-gray-500 hover:text-brand"
        >
          {post.replyCount} repl{post.replyCount === 1 ? "y" : "ies"}
        </button>
      </div>

      {showReplies && (
        <div className="mt-3 space-y-3 border-l-2 border-gray-100 pl-4">
          {replies?.map((r) => (
            <div key={r._id} className="text-sm">
              <span className="font-semibold text-gray-800">
                {r.author?.name}
              </span>{" "}
              <span className="text-gray-600">{r.content}</span>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm"
              placeholder="Write a reply…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && reply.trim() && userId) {
                  await createPost({
                    authorId: userId,
                    content: reply,
                    parentId: post._id,
                    groupId: post.groupId,
                  });
                  setReply("");
                }
              }}
            />
          </div>
        </div>
      )}
    </article>
  );
}

export function Feed({ groupId }: { groupId?: Id<"groups"> }) {
  const { userId } = useCurrentUser();
  const groupPosts = useQuery(
    api.posts.feed,
    groupId ? { groupId, userId } : "skip",
  );
  const followedPosts = useQuery(
    api.posts.userFeed,
    !groupId && userId ? { userId } : "skip",
  );
  const posts = groupId ? groupPosts : followedPosts;

  if (posts === undefined) return <Loading />;

  return (
    <div className="space-y-4">
      <PostComposer groupId={groupId} />
      {posts.length === 0 ? (
        <EmptyState title="No posts yet" />
      ) : (
        posts.map((post) => <PostCard key={post._id} post={post} />)
      )}
    </div>
  );
}
