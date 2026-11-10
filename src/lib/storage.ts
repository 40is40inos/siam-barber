/** localStorage can be missing or throw (private mode, blocked storage); every access is guarded. */

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the app works without it */
  }
}

export const KEYS = {
  lang: "siam:lang",
  me: "siam:me",
  bookings: "siam:bookings",
} as const;

export type Me = { name: string; phone: string };
