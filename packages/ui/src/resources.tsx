"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";
import { EmptyState, Loading } from "./empty-state";

const KIND_ICON: Record<string, string> = {
  category: "📁",
  article: "📄",
  link: "🔗",
};

export function ResourceBrowser() {
  const roots = useQuery(api.resources.children, {});

  if (roots === undefined) return <Loading />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Resource Library</h1>
      {roots.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No resources yet" />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roots.map((res) => (
            <Link
              key={res._id}
              href={`/resources/${res._id}`}
              className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <span className="text-2xl">{KIND_ICON[res.kind]}</span>
              <h3 className="mt-2 font-semibold text-gray-900">{res.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{res.body}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ResourceDetail({ resourceId }: { resourceId: Id<"resources"> }) {
  const resource = useQuery(api.resources.get, { resourceId });

  if (resource === undefined) return <Loading />;
  if (resource === null)
    return <EmptyState title="Resource not found" hint=" " />;

  return (
    <div className="mx-auto max-w-3xl">
      <nav className="text-sm text-gray-400">
        <Link href="/resources" className="hover:text-brand">
          Resources
        </Link>
        {resource.breadcrumb.map((crumb) => (
          <span key={crumb._id}>
            {" / "}
            <Link href={`/resources/${crumb._id}`} className="hover:text-brand">
              {crumb.title}
            </Link>
          </span>
        ))}
      </nav>

      <h1 className="mt-3 text-3xl font-bold text-gray-900">
        {resource.title}
      </h1>
      <p className="mt-4 whitespace-pre-wrap leading-7 text-gray-700">
        {resource.body}
      </p>

      {resource.kind === "link" && resource.url && (
        <a
          href={resource.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Open link →
        </a>
      )}

      {resource.children.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">In this section</h2>
          <ul className="mt-3 space-y-2">
            {resource.children.map((child) => (
              <li key={child._id}>
                <Link
                  href={`/resources/${child._id}`}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-brand"
                >
                  <span>{KIND_ICON[child.kind]}</span>
                  <div>
                    <p className="font-medium text-gray-900">{child.title}</p>
                    <p className="line-clamp-1 text-sm text-gray-500">
                      {child.body}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
