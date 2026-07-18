// Shared UK date formatting utilities.
// Input may be an ISO date string ("YYYY-MM-DD"), full ISO datetime, or Date.

function toDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  // Treat bare YYYY-MM-DD as local-midnight to avoid TZ off-by-one.
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date(input + "T00:00:00");
  return new Date(input);
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "Wed 1 Jul" — for tight spaces (cards, lists). */
export function formatDateShort(input: string | Date): string {
  const d = toDate(input);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "Wed 1st July 2026" — for headers and roomy lists. */
export function formatDateLong(input: string | Date): string {
  const d = toDate(input);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${ordinal(d.getDate())} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Wed 1 Jul, 14:30" — for feed items, notes, audit log rows. */
export function formatDateTime(input: string | Date): string {
  const d = toDate(input);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${hh}:${mm}`;
}

/** "1 Jul 2026" — bare date without weekday, for compact non-UK-locale contexts. */
export function formatDateBare(input: string | Date): string {
  const d = toDate(input);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
