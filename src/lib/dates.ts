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

/** "23/11/2026" — compact UK numeric date (dd/mm/yyyy). */
export function formatUK(input: string | Date): string {
  const d = toDate(input);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** "23/11/2026, 19:05" — UK date with 24h time. */
export function formatUKDateTime(input: string | Date): string {
  const d = toDate(input);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${formatUK(d)}, ${hh}:${mi}`;
}

/** "23/11/2026 → 04/12/2026" — UK date range. */
export function formatDateRangeUK(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): string {
  if (!start && !end) return "—";
  return `${start ? formatUK(start) : "—"} → ${end ? formatUK(end) : "—"}`;
}
