import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "./supabase";

let cachedClient: SupabaseClient | null | undefined;

/** A single browser client preserves the PKCE verifier and auth event stream. */
export function browserAuthClient(): SupabaseClient | null {
  if (cachedClient === undefined) {
    cachedClient = createBrowserSupabaseClient(import.meta.env);
  }
  return cachedClient;
}
