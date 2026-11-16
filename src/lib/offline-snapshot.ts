import type { CatalogData } from "./catalog-api";
import type { CatalogGame, CatalogCategory } from "../../shared/catalog";
import { isLocalDay } from "../../shared/today";

const VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_STORAGE_LENGTH = 512_000;
const CATALOG_KEY = "daydle:public-catalog:v1";
const selectionKey = (userId: string) => `daydle:selected:v1:${userId}`;

type PublicGameSnapshot = Pick<
  CatalogGame,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "publisher"
  | "canonicalUrl"
  | "iconUrl"
  | "status"
  | "cadence"
  | "timezoneName"
  | "parserStatus"
  | "linkStatus"
  | "linkCheckedAt"
  | "categorySlugs"
>;

function projectPublicCatalog(data: CatalogData): CatalogData {
  return {
    games: data.games.slice(0, 250).map((g): PublicGameSnapshot => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      description: g.description,
      publisher: g.publisher,
      canonicalUrl: g.canonicalUrl,
      iconUrl: g.iconUrl,
      status: g.status,
      cadence: g.cadence,
      timezoneName: g.timezoneName,
      parserStatus: g.parserStatus,
      linkStatus: g.linkStatus,
      linkCheckedAt: g.linkCheckedAt,
      categorySlugs: g.categorySlugs.slice(0, 20),
    })),
    categories: data.categories.slice(0, 100).map((c): CatalogCategory => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
    })),
  };
}

function safeStorage(storage: Storage | undefined): Storage | null {
  return storage ?? null;
}

function put(storage: Storage | undefined, key: string, value: unknown): void {
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= MAX_STORAGE_LENGTH)
      safeStorage(storage)?.setItem(key, serialized);
  } catch {
    // Storage may be disabled, private-mode constrained or full.
  }
}

function read(storage: Storage | undefined, key: string, now: number): unknown {
  try {
    const text = safeStorage(storage)?.getItem(key);
    if (!text || text.length > MAX_STORAGE_LENGTH) return null;
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    const item = parsed as {
      version?: unknown;
      savedAt?: unknown;
      value?: unknown;
    };
    if (
      item.version !== VERSION ||
      typeof item.savedAt !== "number" ||
      item.savedAt > now ||
      now - item.savedAt > MAX_AGE_MS
    )
      return null;
    return item.value ?? null;
  } catch {
    return null;
  }
}

function validPublicGame(value: unknown): value is CatalogGame {
  if (!value || typeof value !== "object") return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.id === "string" &&
    typeof g.slug === "string" &&
    typeof g.name === "string" &&
    typeof g.description === "string" &&
    typeof g.canonicalUrl === "string" &&
    Array.isArray(g.categorySlugs) &&
    g.categorySlugs.every((item: unknown) => typeof item === "string") &&
    ["active", "inactive", "retired"].includes(String(g.status)) &&
    ["supported", "experimental", "unsupported"].includes(
      String(g.parserStatus),
    ) &&
    ["verified", "unverified", "broken"].includes(String(g.linkStatus))
  );
}

export function savePublicCatalog(
  storage: Storage | undefined,
  data: CatalogData,
  now = Date.now(),
): void {
  put(storage, CATALOG_KEY, {
    version: VERSION,
    savedAt: now,
    value: projectPublicCatalog(data),
  });
}

export function readPublicCatalog(
  storage: Storage | undefined,
  now = Date.now(),
): CatalogData | null {
  const raw = read(storage, CATALOG_KEY, now);
  if (!raw || typeof raw !== "object") return null;
  const data = raw as { games?: unknown; categories?: unknown };
  if (
    !Array.isArray(data.games) ||
    data.games.length > 250 ||
    !data.games.every(validPublicGame) ||
    !Array.isArray(data.categories) ||
    data.categories.length > 100 ||
    !data.categories.every(
      (c: unknown) =>
        c &&
        typeof c === "object" &&
        typeof (c as CatalogCategory).id === "string" &&
        typeof (c as CatalogCategory).slug === "string" &&
        typeof (c as CatalogCategory).name === "string",
    )
  )
    return null;
  return {
    games: data.games,
    categories: data.categories as CatalogCategory[],
  };
}

/** Only callable with an authenticated identity. Saved choices are public;
 *  private manual played flags, results, email, clipboard and tokens are NEVER cached. */
export function saveSelectedSnapshot(
  storage: Storage | undefined,
  userId: string,
  ids: string[],
  now = Date.now(),
): void {
  if (!userId || ids.length > 100 || ids.some((id) => typeof id !== "string"))
    return;
  put(storage, selectionKey(userId), {
    version: VERSION,
    savedAt: now,
    value: [...ids],
  });
}

export function readSelectedSnapshot(
  storage: Storage | undefined,
  authenticatedUserId: string | null,
  now = Date.now(),
): string[] | null {
  if (!authenticatedUserId) return null;
  const raw = read(storage, selectionKey(authenticatedUserId), now);
  if (
    !Array.isArray(raw) ||
    raw.length > 100 ||
    raw.some((item) => typeof item !== "string")
  )
    return null;
  return raw as string[];
}

export function clearSelectedSnapshot(
  storage: Storage | undefined,
  userId: string,
): void {
  try {
    safeStorage(storage)?.removeItem(selectionKey(userId));
  } catch {
    /* unavailable */
  }
}

/** Do not write private user activity into offline cache. */
export function isSafeOfflineDayLabel(day: unknown): boolean {
  return isLocalDay(day);
}
