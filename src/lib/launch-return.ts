const KEY = "daydle:last-publisher-launch:v1";
const MAX_AGE_MS = 4 * 60 * 60 * 1000;
const SLUG = /^[a-z0-9][a-z0-9-]{1,63}$/;

export interface LaunchHint {
  slug: string;
  launchedAt: number;
}

export function recordPublisherLaunch(
  storage: Storage | undefined,
  slug: string,
  now = Date.now(),
): void {
  if (!SLUG.test(slug)) return;
  try {
    storage?.setItem(KEY, JSON.stringify({ slug, launchedAt: now }));
  } catch {
    /* session storage is optional */
  }
}

export function readPublisherLaunch(
  storage: Storage | undefined,
  now = Date.now(),
): LaunchHint | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw || raw.length > 200) return null;
    const item: unknown = JSON.parse(raw);
    if (!item || typeof item !== "object") return null;
    const launch = item as Partial<LaunchHint>;
    if (
      !launch.slug ||
      !SLUG.test(launch.slug) ||
      typeof launch.launchedAt !== "number" ||
      launch.launchedAt > now ||
      now - launch.launchedAt > MAX_AGE_MS
    )
      return null;
    return { slug: launch.slug, launchedAt: launch.launchedAt };
  } catch {
    return null;
  }
}

export function clearPublisherLaunch(storage: Storage | undefined): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    /* optional */
  }
}
