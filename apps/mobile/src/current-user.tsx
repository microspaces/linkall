import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Doc, Id } from "@linkall/backend/convex/_generated/dataModel";

/** Demo-user selection; swap for real auth later (see repo README). */

interface CurrentUserValue {
  user: Doc<"users"> | null;
  userId: Id<"users"> | undefined;
  setUserId: (id: Id<"users">) => void;
}

const CurrentUserContext = createContext<CurrentUserValue | null>(null);
const STORAGE_KEY = "linkall.demoUserId";

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const users = useQuery(api.users.list);
  const [storedId, setStoredId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(setStoredId);
  }, []);

  const user = users?.find((u) => u._id === storedId) ?? users?.[0] ?? null;

  const setUserId = (id: Id<"users">) => {
    AsyncStorage.setItem(STORAGE_KEY, id);
    setStoredId(id);
  };

  return (
    <CurrentUserContext.Provider value={{ user, userId: user?._id, setUserId }}>
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
