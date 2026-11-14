export interface CaptchaEnvironment {
  VITE_TURNSTILE_SITE_KEY?: string;
}

/**
 * Cloudflare Turnstile site keys are public by design (they ship in the page).
 * The matching secret key lives only in Supabase Auth settings and is never read here.
 * Returns null when unset or malformed so the app still renders without a CAPTCHA.
 */
export function readTurnstileSiteKey(env: CaptchaEnvironment): string | null {
  const key = env.VITE_TURNSTILE_SITE_KEY?.trim();
  if (!key) return null;
  return /^[0-9]x[A-Za-z0-9_-]{16,}$/.test(key) ? key : null;
}
