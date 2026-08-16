import { createContext, useContext, type ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Doc, Id } from "@linkall/backend/convex/_generated/dataModel";

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
  const { signOut } = useAuthActions();

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
