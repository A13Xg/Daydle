/** Accept either 1234 or 1,234, reject negatives/zero/malformed commas. */
export function parsePuzzleNumber(input: string): number | null {
  if (!/^(?:[1-9]\d{0,6}|[1-9]\d{0,2}(?:,\d{3}){1,2})$/u.test(input))
    return null;
  const n = Number(input.replace(/,/gu, ""));
  return Number.isSafeInteger(n) && n > 0 && n <= 9_999_999 ? n : null;
}

export function parseUSDate(
  monthText: string,
  dayText: string,
  yearText: string,
): string | null {
  const month = Number(monthText);
  const day = Number(dayText);
  const year = Number(yearText);
  if (
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  )
    return null;
  return (
    String(year) +
    "-" +
    String(month).padStart(2, "0") +
    "-" +
    String(day).padStart(2, "0")
  );
}

export function countTiles(
  line: string,
  allowed: ReadonlySet<string>,
): string[] | null {
  const tiles = Array.from(line.replace(/\s/gu, ""));
  return tiles.length > 0 && tiles.every((tile) => allowed.has(tile))
    ? tiles
    : null;
}
