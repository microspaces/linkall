"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";
import { Avatar } from "./avatar";
import { useCurrentUser } from "./current-user";
import { EmptyState, Loading } from "./empty-state";
import { timeAgo } from "./format";

const CATEGORIES = [
  "border",
  "elections",
  "education",
  "crime",
  "energy",
  "economy",
  "healthcare",
  "general",
] as const;

const STATUSES = ["proposed", "implementing", "working", "stalled"] as const;

type Status = (typeof STATUSES)[number];

const STATUS_STYLE: Record<Status, string> = {
  proposed: "bg-gray-100 text-gray-700",
  implementing: "bg-blue-100 text-blue-800",
  working: "bg-emerald-100 text-emerald-800",
  stalled: "bg-amber-100 text-amber-900",
};

const STATUS_LABEL: Record<Status, string> = {
  proposed: "Needs implementing",
  implementing: "Implementing",
  working: "Working",
  stalled: "Stalled",
};

function StatusBadge({ status }: { status: string }) {
  const key = (STATUSES as readonly string[]).includes(status)
    ? (status as Status)
    : "proposed";
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide " +
        STATUS_STYLE[key]
      }
    >
      {STATUS_LABEL[key]}
    </span>
  );
}

export function SolutionList({ groupId }: { groupId?: Id<"groups"> }) {
  const { userId } = useCurrentUser();
  const [status, setStatus] = useState<Status | "all">("all");
  const [category, setCategory] = useState<string>("all");
  const solutions = useQuery(api.solutions.list, {
    userId,
    groupId,
    status: status === "all" ? undefined : status,
    category: category === "all" ? undefined : category,
  });

  if (solutions === undefined) return <Loading />;

  return (
    <div>
      {!groupId && (
        <>
          <h1 className="text-2xl font-bold text-gray-900">
            America First Solutions
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            What is working, what still needs to be implemented, and which
            responses are the working answer — like Stack Overflow, for policy.
          </p>
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <select
          className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as Status | "all")}
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {!groupId && <SolutionComposer />}

      {solutions.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No solutions yet" />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {solutions.map((s) => (
            <Link
              key={s._id}
              href={`/solutions/${s._id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={s.status} />
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  {s.category}
                </span>
                {s.group && (
                  <span className="text-xs text-gray-400">{s.group.name}</span>
                )}
              </div>
              <h3 className="mt-2 font-semibold text-gray-900">{s.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">{s.body}</p>
              {s.outcome && (
                <p className="mt-2 text-sm font-medium text-emerald-700">
                  Result: {s.outcome}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-400">
                ▲ {s.upvotes} · {s.responseCount} response
                {s.responseCount === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SolutionComposer() {
  const { userId } = useCurrentUser();
  const create = useMutation(api.solutions.create);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("border");
  const [status, setStatus] = useState<Status>("proposed");
  const [successNote, setSuccessNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!userId) return null;

  const submit = async () => {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      await create({
        authorId: userId,
        title,
        body,
        category,
        status,
        successNote: successNote || undefined,
      });
      setTitle("");
      setBody("");
      setSuccessNote("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Post a solution
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <input
        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        placeholder="What America First solution is this?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        rows={4}
        placeholder="Describe the problem, the play, and how we will know it worked."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <textarea
        className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        rows={2}
        placeholder="How will success be tracked? (metric, source, cadence)"
        value={successNote}
        onChange={(e) => setSuccessNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !title.trim() || !body.trim()}
            className="rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}

export function SolutionDetail({
  solutionId,
}: {
  solutionId: Id<"solutions">;
}) {
  const { user, userId } = useCurrentUser();
  const view = useQuery(
    api.solutions.get,
    userId ? { solutionId, userId } : { solutionId },
  );
  const toggleUpvote = useMutation(api.solutions.toggleUpvote);
  const toggleWorking = useMutation(api.solutions.toggleWorking);
  const toggleResponseUpvote = useMutation(api.solutions.toggleResponseUpvote);
  const addResponse = useMutation(api.solutions.addResponse);
  const setStatus = useMutation(api.solutions.setStatus);
  const setSuccess = useMutation(api.solutions.setSuccess);
  const [reply, setReply] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (view === undefined) return <Loading />;
  if (view === null) return <EmptyState title="Solution not found" hint=" " />;

  const canModerate =
    !!userId && (userId === view.authorId || user?.tier === "admin");

  const submitReply = async () => {
    if (!userId || !reply.trim()) return;
    setBusy(true);
    try {
      await addResponse({ solutionId, authorId: userId, body: reply });
      setReply("");
    } finally {
      setBusy(false);
    }
  };

  const saveSuccess = async () => {
    if (!userId) return;
    await setSuccess({
      solutionId,
      userId,
      outcome: outcome ?? view.outcome,
      successNote: note ?? view.successNote,
    });
    setOutcome(null);
    setNote(null);
  };

  return (
    <div>
      <nav className="text-sm text-gray-400">
        <Link href="/solutions" className="hover:text-brand">
          Solutions
        </Link>
        {" / "}
        <span className="text-gray-600">{view.category}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={view.status} />
        {canModerate && (
          <select
            className="rounded-md border border-gray-200 px-2 py-1 text-xs"
            value={view.status}
            onChange={(e) =>
              userId &&
              setStatus({
                solutionId,
                userId,
                status: e.target.value as Status,
              })
            }
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        )}
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
          {view.category}
        </span>
        {view.group && (
          <Link
            href={`/groups/${view.group._id}`}
            className="text-xs text-brand hover:underline"
          >
            {view.group.name}
          </Link>
        )}
      </div>

      <h1 className="mt-2 text-3xl font-bold text-gray-900">{view.title}</h1>
      <div className="mt-3 flex items-center gap-3">
        <Avatar name={view.author?.name ?? "?"} src={view.author?.avatarUrl} />
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {view.author?.name ?? "Unknown"}
          </p>
          <p className="text-xs text-gray-400">{timeAgo(view._creationTime)}</p>
        </div>
      </div>
      <p className="mt-4 whitespace-pre-wrap leading-7 text-gray-700">
        {view.body}
      </p>
      <button
        onClick={() => userId && toggleUpvote({ solutionId, userId })}
        className={
          "mt-3 text-sm " +
          (view.hasUpvoted
            ? "font-semibold text-brand"
            : "text-gray-500 hover:text-brand")
        }
      >
        ▲ {view.upvotes}
      </button>

      <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          Success tracking
        </h2>
        {canModerate ? (
          <div className="mt-3 space-y-2">
            <input
              className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm"
              placeholder="Measured result (e.g. encounters down 61%)"
              value={outcome ?? view.outcome ?? ""}
              onChange={(e) => setOutcome(e.target.value)}
            />
            <textarea
              className="w-full resize-none rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm"
              rows={2}
              placeholder="How we know it worked — metric, source, cadence"
              value={note ?? view.successNote ?? ""}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              onClick={saveSuccess}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              Save tracking
            </button>
          </div>
        ) : (
          <div className="mt-2 space-y-1 text-sm text-emerald-950">
            {view.outcome && (
              <p>
                <span className="font-semibold">Result:</span> {view.outcome}
              </p>
            )}
            {view.successNote && (
              <p>
                <span className="font-semibold">How we track:</span>{" "}
                {view.successNote}
              </p>
            )}
            {!view.outcome && !view.successNote && (
              <p className="text-emerald-800/70">
                No result posted yet. The author can add a metric here.
              </p>
            )}
          </div>
        )}
      </section>

      <h2 className="mt-8 text-lg font-semibold text-gray-900">
        Responses
        <span className="ml-2 text-sm font-normal text-gray-400">
          Mark the ones that are a working solution
        </span>
      </h2>

      <div className="mt-4 space-y-4">
        {view.responses.map((r) => (
          <article
            key={r._id}
            className={
              "rounded-xl border bg-white p-4 " +
              (r.isWorking
                ? "border-emerald-400 ring-1 ring-emerald-200"
                : "border-gray-200")
            }
          >
            {r.isWorking && (
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">
                ✓ Working solution
              </p>
            )}
            <div className="flex items-center gap-3">
              <Avatar name={r.author?.name ?? "?"} src={r.author?.avatarUrl} />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {r.author?.name ?? "Unknown"}
                </p>
                <p className="text-xs text-gray-400">
                  {timeAgo(r._creationTime)}
                </p>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800">
              {r.body}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <button
                onClick={() =>
                  userId && toggleResponseUpvote({ responseId: r._id, userId })
                }
                className={
                  r.hasUpvoted
                    ? "font-semibold text-brand"
                    : "text-gray-500 hover:text-brand"
                }
              >
                ▲ {r.upvotes}
              </button>
              {canModerate && (
                <button
                  onClick={() =>
                    userId && toggleWorking({ responseId: r._id, userId })
                  }
                  className={
                    "rounded-md px-2 py-0.5 text-xs font-semibold " +
                    (r.isWorking
                      ? "bg-emerald-100 text-emerald-800"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50")
                  }
                >
                  {r.isWorking ? "Unmark working" : "Mark as working"}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {userId && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <textarea
            className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            rows={3}
            placeholder="Add a response — a play that is working, or one that still needs to be implemented."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={submitReply}
              disabled={busy || !reply.trim()}
              className="rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
            >
              Post response
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
