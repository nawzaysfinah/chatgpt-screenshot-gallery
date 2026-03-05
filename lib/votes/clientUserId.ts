const STORAGE_KEY = "chatgpt-screenshot-gallery:user-id";

export function getClientUserId(): string {
  if (typeof window === "undefined") {
    return "server-render";
  }

  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `anon-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  window.localStorage.setItem(STORAGE_KEY, generated);
  return generated;
}
