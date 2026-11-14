import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readPublicSupabaseConfig, type PublicEnvironment } from "./config";

/**
 * Deliberately lazy. The app shell runs before an external Supabase project exists.
 * Never call this with service-role credentials.
 */
export function createBrowserSupabaseClient(env: PublicEnvironment): SupabaseClient | null {
  const config = readPublicSupabaseConfig(env);

  if (config.status !== "configured") {
    return null;
  }

  return createClient(config.url, config.publishableKey);
}
