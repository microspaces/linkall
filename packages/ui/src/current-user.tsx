"use client";

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Doc, Id } from "@linkall/backend/convex/_generated/dataModel";
import { Avatar } from "./avatar";

interface CurrentUserValue {
  user: Doc<"users"> | null;
  userId: Id<"users"> | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const ensureMembership = useMutation(api.groups.ensureMembership);
  const { signOut } = useAuthActions();

  useEffect(() => {
    if (user?._id) void ensureMembership({ userId: user._id });
  }, [user?._id, ensureMembership]);

  return (
    <CurrentUserContext.Provider
      value={{
        user: user ?? null,
        userId: user?._id,
        isLoading: isLoading || (isAuthenticated && user === undefined),
        isAuthenticated,
        signOut,
      }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUserValue {
  const value = useContext(CurrentUserContext);
  if (!value)
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  return value;
}

/** Header control: sign-in link or avatar + sign out. */
export function AuthUserMenu() {
  const { user, isLoading, signOut } = useCurrentUser();

  if (isLoading) {
    return (
      <div
        className="h-8 w-24 animate-pulse rounded-md bg-gray-200"
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <Link
        href="/signin"
        className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Avatar name={user.name} src={user.avatarUrl} size={28} />
      <span className="hidden max-w-28 truncate text-sm text-gray-700 sm:inline">
        {user.name}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
      >
        Sign out
      </button>
    </div>
  );
}

/** @deprecated Use AuthUserMenu — kept so existing imports keep compiling. */
export const UserSwitcher = AuthUserMenu;
