"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Doc, Id } from "@linkall/backend/convex/_generated/dataModel";
import { useBrand } from "./brand-context";
import { useCurrentUser } from "./current-user";
import { UserSwitcher } from "./current-user";

/**
 * Legacy 3-column social layout (Surroundshow _Layout + responsive-menu.js).
 *
 * - Left sidebar: Top / Hot / Info / Favorites — shrinks to icon-only below 768px
 * - Right sidebar: Favorites / Followed / Not Followed — fixed ≥790px, hamburger <790px
 * - Center: page content with margins that track the sidebars
 */

type SidebarGroup = Doc<"groups"> & { isMember: boolean; isFavorite: boolean };

const CHROMELESS_PREFIXES = [
  "/player",
  "/screens",
  "/performance/screens",
  "/battle-loco",
  "/wrestle-loco",
];

const CHROMELESS_HOSTS = [
  "battleloco.com",
  "www.battleloco.com",
  "wrestleloco.com",
  "www.wrestleloco.com",
];

function isChromeless(pathname: string, host?: string) {
  if (host && CHROMELESS_HOSTS.includes(host)) return true;
  return CHROMELESS_PREFIXES.some((p) => pathname.startsWith(p));
}

function GroupLink({ group }: { group: SidebarGroup }) {
  return (
    <Link
      href={`/groups/${group._id}`}
      className="flex items-center gap-2 rounded px-1 py-1.5 text-xs text-gray-700 hover:bg-gray-200/80 md:gap-2.5 md:px-2 md:py-2 md:text-sm"
    >
      {group.photoUrl ? (
        <img
          src={group.photoUrl}
          alt=""
          className="h-5 w-5 shrink-0 rounded-full object-cover md:h-8 md:w-8"
        />
      ) : (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-light text-[10px] font-bold text-brand md:h-8 md:w-8 md:text-xs">
          {group.name[0]}
        </span>
      )}
      <span className="max-md:line-clamp-2 max-md:text-center max-md:text-[9px] max-md:leading-tight">
        {group.name}
      </span>
    </Link>
  );
}

function SidebarSection({
  title,
  children,
  compact,
}: {
  title: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mb-2" : "mb-4"}>
      <h4 className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 max-md:text-center md:text-xs">
        {title}
      </h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function LeftSidebar() {
  const { userId } = useCurrentUser();
  const brand = useBrand();
  const sidebar = useQuery(api.groups.sidebar, userId ? { userId } : {});

  if (!sidebar) {
    return (
      <aside className="fixed bottom-0 left-0 top-14 z-30 w-16 border-r border-gray-200 bg-gray-50 md:w-52" />
    );
  }

  return (
    <aside
      className={
        "fixed bottom-0 left-0 top-14 z-30 overflow-y-auto border-r border-gray-200 bg-gray-50 " +
        "w-16 px-1 py-3 transition-[width] duration-200 md:w-52 md:px-3"
      }
    >
      {brand.features.shows && (
        <Link
          href="/designer"
          className="mb-3 flex flex-col items-center gap-0.5 rounded px-1 py-2 text-[9px] font-semibold text-gray-700 hover:bg-gray-200/80 md:flex-row md:gap-2 md:text-sm"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded bg-brand text-[10px] text-white md:h-8 md:w-8 md:text-xs">
            D
          </span>
          <span className="max-md:text-center">{brand.designerLabel}</span>
        </Link>
      )}

      <SidebarSection title="Top">
        {sidebar.top.map((g) => (
          <GroupLink key={g._id} group={g} />
        ))}
      </SidebarSection>

      <SidebarSection title="Hot">
        {sidebar.hot.map((g) => (
          <GroupLink key={g._id} group={g} />
        ))}
      </SidebarSection>

      <SidebarSection title="Info">
        <Link
          href="/groups"
          className="flex flex-col items-center gap-0.5 rounded px-1 py-1.5 text-[9px] text-gray-700 hover:bg-gray-200/80 md:flex-row md:gap-2 md:py-2 md:text-sm"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[10px] md:h-8 md:w-8">
            {brand.groupsLabel[0]}
          </span>
          <span>{brand.groupsLabel}</span>
        </Link>
      </SidebarSection>

      <SidebarSection title="Favorites">
        {sidebar.favorites.length === 0 ? (
          <p className="px-1 text-[10px] text-gray-400 max-md:text-center md:text-xs">
            None yet
          </p>
        ) : (
          sidebar.favorites.map((g) => (
            <GroupLink key={g._id} group={g} />
          ))
        )}
      </SidebarSection>
    </aside>
  );
}

type SidebarData = FunctionReturnType<typeof api.groups.sidebar>;

function RightSidebarPanel({
  sidebar,
  onJoin,
  onLeave,
}: {
  sidebar: SidebarData;
  onJoin: (id: Id<"groups">) => void;
  onLeave: (id: Id<"groups">) => void;
}) {
  return (
    <div className="space-y-4 p-3">
      <SidebarSection title="Favorites">
        {sidebar.favorites.length === 0 ? (
          <p className="text-xs text-gray-400">None yet</p>
        ) : (
          sidebar.favorites.map((g) => <GroupLink key={g._id} group={g} />)
        )}
      </SidebarSection>

      <SidebarSection title="Followed">
        {sidebar.followed.map((g) => (
          <div key={g._id} className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <GroupLink group={g} />
            </div>
            <button
              onClick={() => onLeave(g._id)}
              className="shrink-0 text-[10px] text-gray-400 hover:text-red-500"
              title="Unfollow"
            >
              ×
            </button>
          </div>
        ))}
      </SidebarSection>

      <SidebarSection title="Not Followed">
        {sidebar.notFollowed.map((g) => (
          <div key={g._id} className="flex items-center gap-1">
            <div className="min-w-0 flex-1 opacity-70">
              <GroupLink group={g} />
            </div>
            <button
              onClick={() => onJoin(g._id)}
              className="shrink-0 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white"
            >
              +
            </button>
          </div>
        ))}
      </SidebarSection>
    </div>
  );
}

function RightSidebar() {
  const { userId } = useCurrentUser();
  const sidebar = useQuery(api.groups.sidebar, userId ? { userId } : {});
  const join = useMutation(api.groups.join);
  const leave = useMutation(api.groups.leave);

  if (!sidebar || !userId) return null;

  return (
    <aside
      className={
        "fixed bottom-0 right-0 top-14 z-30 hidden w-52 overflow-y-auto " +
        "border-l border-gray-200 bg-gray-50 min-[790px]:block"
      }
    >
      <RightSidebarPanel
        sidebar={sidebar}
        onJoin={(id) => join({ groupId: id, userId })}
        onLeave={(id) => leave({ groupId: id, userId })}
      />
    </aside>
  );
}

function MobileGroupsMenu() {
  const [open, setOpen] = useState(false);
  const { userId } = useCurrentUser();
  const sidebar = useQuery(api.groups.sidebar, userId ? { userId } : {});
  const join = useMutation(api.groups.join);
  const leave = useMutation(api.groups.leave);

  if (!sidebar || !userId) return null;

  return (
    <div className="relative min-[790px]:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        aria-label="Groups menu"
      >
        ☰
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 max-h-[70vh] w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            <RightSidebarPanel
              sidebar={sidebar}
              onJoin={(id) => {
                join({ groupId: id, userId });
                setOpen(false);
              }}
              onLeave={(id) => leave({ groupId: id, userId })}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function SocialShell({ children }: { children: ReactNode }) {
  const brand = useBrand();
  const pathname = usePathname();
  const [host, setHost] = useState<string | undefined>(undefined);

  useEffect(() => {
    setHost(window.location.host);
  }, []);

  const chromeless = isChromeless(pathname, host);

  if (chromeless) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-3 md:px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
              {brand.name[0]}
            </span>
            <span className="hidden text-lg font-semibold tracking-tight text-gray-900 sm:inline">
              {brand.name}
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <MobileGroupsMenu />
            <UserSwitcher />
          </div>
        </div>
      </header>

      <LeftSidebar />
      <RightSidebar />

      <main
        className={
          "flex-1 py-4 transition-[margin] duration-200 " +
          "ml-16 px-2 md:ml-52 md:px-4 " +
          "min-[790px]:mr-52"
        }
      >
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>

      <footer className="ml-16 border-t border-gray-200 bg-white py-4 md:ml-52 min-[790px]:mr-52">
        <div className="px-4 text-sm text-gray-400">
          {brand.name} · {brand.tagline}
        </div>
      </footer>
    </div>
  );
}
