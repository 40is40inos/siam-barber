/**
 * Phone numbers are stored in E.164 (+306912345678).
 * Greek numbers can be typed with or without +30 / 0030; foreign ones need their + prefix.
 */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let v = input.trim().replace(/[\s().\-\/]/g, "");
  if (v.startsWith("00")) v = `+${v.slice(2)}`;
  if (!/^\+?\d+$/.test(v)) return null;

  if (v.startsWith("+30")) v = v.slice(3);
  else if (v.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(v) ? v : null;

  return /^(2\d{9}|69\d{8})$/.test(v) ? `+30${v}` : null;
}

/** "+306912345678" → "691 234 5678"; foreign numbers are returned as stored. */
export function formatPhone(e164: string): string {
  if (!e164.startsWith("+30") || e164.length !== 13) return e164;
  const n = e164.slice(3);
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}

/** Max length of a booking note. */
export const NOTE_MAX = 200;

/**
 * Optional booking note: empty means none (null); over NOTE_MAX characters is invalid (false).
 * Line breaks, tabs and other control characters become single spaces.
 */
export function normalizeNote(input: unknown): string | null | false {
  if (input === undefined || input === null) return null;
  if (typeof input !== "string") return false;
  // Any whitespace or control character (line breaks, tabs…) becomes a single space.
  const v = input.replace(/[\s\p{Cc}]+/gu, " ").trim();
  if (!v) return null;
  return [...v].length > NOTE_MAX ? false : v;
}

export function normalizeName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.replace(/\s+/g, " ").trim();
  if (v.length < 2 || v.length > 60) return null;
  if (!/\p{L}/u.test(v)) return null;
  return v;
}
