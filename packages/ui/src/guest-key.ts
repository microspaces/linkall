const STORAGE_KEY = "linkall.guestKey.v1";

function randomKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function readGuestKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const next = randomKey();
    window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return randomKey();
  }
}
