export interface PublicEnvironment {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export type PublicSupabaseConfig =
  | { status: "unconfigured" }
  | { status: "invalid"; reason: string }
  | { status: "configured"; url: string; publishableKey: string };

export function readPublicSupabaseConfig(
  env: PublicEnvironment,
): PublicSupabaseConfig {
  const urlText = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!urlText && !publishableKey) {
    return { status: "unconfigured" };
  }

  if (!urlText || !publishableKey) {
    return {
      status: "invalid",
      reason: "Both public Supabase variables are required.",
    };
  }

  let url: URL;
  try {
    url = new URL(urlText);
  } catch {
    return {
      status: "invalid",
      reason: "Supabase URL must be an absolute URL.",
    };
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && localHosts.has(url.hostname))
  ) {
    return {
      status: "invalid",
      reason: "Supabase URL must use HTTPS outside local development.",
    };
  }

  if (
    !publishableKey.startsWith("sb_publishable_") ||
    publishableKey.length <= "sb_publishable_".length
  ) {
    return {
      status: "invalid",
      reason:
        "Use a Supabase publishable key, never a secret or service-role key.",
    };
  }

  return { status: "configured", url: url.origin, publishableKey };
}
