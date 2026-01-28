/**
 * Date utilities aligned with backend Philippines (Asia/Manila, UTC+8) business day.
 * Use these when sending dates to the API or comparing "today" with backend.
 */

const PH_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8

/**
 * Get today's date string (YYYY-MM-DD) in Philippines timezone.
 * Use when sending startDate/endDate to analytics API or comparing with backend "today".
 */
export function getPhilippinesDateString(date: Date = new Date()): string {
  const phTime = new Date(date.getTime() + PH_OFFSET_MS);
  const y = phTime.getUTCFullYear();
  const m = String(phTime.getUTCMonth() + 1).padStart(2, '0');
  const d = String(phTime.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get midnight (start of day) in Philippines for a given date, as a Date (UTC instant).
 * Use when you need a Date object for "today" in PH (e.g. for comparisons).
 */
export function getPhilippinesMidnight(date: Date = new Date()): Date {
  const phTime = new Date(date.getTime() + PH_OFFSET_MS);
  phTime.setUTCHours(0, 0, 0, 0);
  return new Date(phTime.getTime() - PH_OFFSET_MS);
}
