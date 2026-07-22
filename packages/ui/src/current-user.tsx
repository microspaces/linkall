"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Doc, Id } from "@linkall/backend/convex/_generated/dataModel";
import { Avatar } from "./avatar";

/**
 * Demo-user selection, standing in for real authentication while testing
 * with mock data. Swap for Convex Auth or Clerk later — consumers only use
 * `useCurrentUser()`, so the swap is contained to this file.
 */

interface CurrentUserValue {
  user: Doc<"users"> | null;
  userId: Id<"users"> | undefined;
  setUserId: (id: Id<"users"> | null) => void;
}

const CurrentUserContext = createContext<CurrentUserValue | null>(null);
const STORAGE_KEY = "linkall.demoUserId";

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const users = useQuery(api.users.list);
  const ensureMembership = useMutation(api.groups.ensureMembership);
  const [storedId, setStoredId] = useState<string | null>(null);

  useEffect(() => {
    setStoredId(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const user =
    users?.find((u) => u._id === storedId) ?? users?.[0] ?? null;

  // Legacy: new users auto-subscribe to all public groups.
  useEffect(() => {
    if (user?._id) void ensureMembership({ userId: user._id });
  }, [user?._id, ensureMembership]);

  const setUserId = (id: Id<"users"> | null) => {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
    setStoredId(id);
  };

  return (
    <CurrentUserContext.Provider
      value={{ user, userId: user?._id, setUserId }}
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

export function UserSwitcher() {
  const users = useQuery(api.users.list);
  const { user, setUserId } = useCurrentUser();

  if (!users || users.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {user && <Avatar name={user.name} src={user.avatarUrl} size={28} />}
      <select
        aria-label="Demo user"
        className="max-w-36 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
        value={user?._id ?? ""}
        onChange={(e) => setUserId(e.target.value as Id<"users">)}
      >
        {users.map((u) => (
          <option key={u._id} value={u._id}>
            {u.name}
          </option>
        ))}
      </select>
    </div>
  );
}
