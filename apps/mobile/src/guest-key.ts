import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "linkall.guestKey.v1";

function randomKey(): string {
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function loadGuestKey(): Promise<string> {
  const existing = await AsyncStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const next = randomKey();
  await AsyncStorage.setItem(STORAGE_KEY, next);
  return next;
}
