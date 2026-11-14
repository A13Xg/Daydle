import type { SupabaseClient } from "@supabase/supabase-js";

export type OAuthProvider = "apple" | "google";
export type RegistrationOutcome = "signed-in" | "verify-email";

export function validateDisplayName(input: string): string {
  const value = input.trim();
  if (value.length < 1 || value.length > 80) {
    throw new Error("Display name must contain 1–80 characters.");
  }
  return value;
}

export function validateEmail(input: string): string {
  const value = input.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) {
    throw new Error("Enter a valid email address.");
  }
  return value;
}

export function validatePassword(password: string): string {
  if (password.length < 8 || password.length > 128) {
    throw new Error("Password must contain 8–128 characters.");
  }
  return password;
}

export function callbackUrl(origin: string, recovery = false): string {
  const base = new URL(origin);
  if (
    base.protocol !== "https:" &&
    !(
      base.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
    )
  ) {
    throw new Error("Authentication callback requires a secure origin.");
  }

  const url = new URL("/auth/callback", base.origin);
  if (recovery) url.searchParams.set("flow", "recovery");
  return url.toString();
}

export async function registerEmail(
  client: SupabaseClient,
  email: string,
  password: string,
  displayName: string,
  origin: string,
): Promise<RegistrationOutcome> {
  const { data, error } = await client.auth.signUp({
    email: validateEmail(email),
    password: validatePassword(password),
    options: {
      data: { display_name: validateDisplayName(displayName) },
      emailRedirectTo: callbackUrl(origin),
    },
  });

  if (error) throw error;
  return data.session ? "signed-in" : "verify-email";
}

export async function loginEmail(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<void> {
  const { data, error } = await client.auth.signInWithPassword({
    email: validateEmail(email),
    password,
  });

  if (error) throw error;
  if (!data.session)
    throw new Error("Authentication did not establish a session.");
}

export async function sendPasswordRecovery(
  client: SupabaseClient,
  email: string,
  origin: string,
): Promise<void> {
  const { error } = await client.auth.resetPasswordForEmail(
    validateEmail(email),
    { redirectTo: callbackUrl(origin, true) },
  );
  if (error) throw error;
}

export async function startOAuth(
  client: SupabaseClient,
  provider: OAuthProvider,
  origin: string,
): Promise<string> {
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl(origin),
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url)
    throw new Error("The identity provider did not provide a login URL.");

  const redirect = new URL(data.url);
  if (
    redirect.protocol !== "https:" &&
    !(
      redirect.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(redirect.hostname)
    )
  ) {
    throw new Error("The identity provider returned an unsafe URL.");
  }
  return redirect.toString();
}

export async function exchangeAuthCode(
  client: SupabaseClient,
  code: string,
): Promise<void> {
  if (!code) throw new Error("Missing authorization code.");
  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error) throw error;
  if (!data.session)
    throw new Error("Authentication did not establish a session.");
}

export async function changePassword(
  client: SupabaseClient,
  newPassword: string,
): Promise<void> {
  const { error } = await client.auth.updateUser({
    password: validatePassword(newPassword),
  });
  if (error) throw error;
}

export function authCallbackDestination(search: string): string {
  const params = new URLSearchParams(search);
  return params.get("flow") === "recovery" ? "/account?reset=1" : "/account";
}
