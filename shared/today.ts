/** A browser-local day, not a publisher puzzle date or confirmed result. */
export function localDayString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isLocalDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined)
    return false;
  const check = new Date(year, month - 1, day);
  return (
    check.getFullYear() === year &&
    check.getMonth() + 1 === month &&
    check.getDate() === day &&
    year >= 2000
  );
}

export function manualPlayedLabel(marked: boolean, available: boolean): string {
  if (!available) return "Played status unavailable offline";
  return marked ? "Marked played (manual)" : "Not marked played";
}
