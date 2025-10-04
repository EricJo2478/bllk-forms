// src/utils.ts
export function normalizeName(n: string) {
  return n.trim().toLowerCase().replace(/\s+/g, " ");
}
export function makeStaffKey(a: string, b: string) {
  const [x, y] = [normalizeName(a), normalizeName(b)].sort();
  return `${x}__${y}`; // e.g., "alex jones__pat smith"
}

export function dateToISO(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** ISO week number per ISO-8601 (weeks start on Monday). */
export function getISOWeekYear(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Thursday in current week decides the year.
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const isoYear = date.getUTCFullYear();
  // Week number is the week of the year that contains this date's Thursday.
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week =
    1 + Math.round((date.getTime() - firstThursday.getTime()) / 604800000);
  return { isoYear, week };
}
export function dateKeyWeekly(d = new Date()) {
  const { isoYear, week } = getISOWeekYear(d);
  return `${isoYear}-W${String(week).padStart(2, "0")}`; // e.g., 2025-W38
}

export function asInputString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  // prevent {} or other shapes from reaching <Form.Control value=…>
  return "";
}
