import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { startOAuth, type OAuthProvider } from "../lib/auth-actions";

interface AuthPageProps {
  client: SupabaseClient | null;
  signedIn: boolean;
}

const PROVIDERS: ReadonlyArray<{ id: OAuthProvider; name: string }> = [
  { id: "apple", name: "Apple" },
  { id: "google", name: "Google" },
];

/**
 * Daydle signs people in with Apple or Google only. The same buttons sign in
 * existing users and create accounts for new ones, so there is no password.
 */
export function AuthPage({ client, signedIn }: AuthPageProps) {
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(
    null,
  );
  const [error, setError] = useState("");

  // Safari restores pages from its back/forward cache when someone backs out of
  // a provider screen; without this the buttons would stay stuck on "Connecting".
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) setPendingProvider(null);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  async function onProvider(provider: OAuthProvider) {
    if (!client || pendingProvider) return;
    setPendingProvider(provider);
    setError("");
    try {
      const url = await startOAuth(client, provider, window.location.origin);
      window.location.assign(url);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to connect to the provider. Please try again.",
      );
      setPendingProvider(null);
    }
  }

  if (signedIn) {
    return (
      <section aria-labelledby="auth-title" className="panel auth-panel">
        <h1 id="auth-title">You are signed in</h1>
        <p>Manage your profile and friend code from your account.</p>
        <a href="/account">Go to my account</a>
      </section>
    );
  }

  const busy = pendingProvider !== null;

  return (
    <section aria-labelledby="auth-title" className="panel auth-panel">
      <h1 id="auth-title">Sign in to Daydle</h1>
      <p>
        Continue with your Apple or Google account. The same buttons sign you in
        or create your account, so there is no password to remember.
      </p>

      {!client && (
        <div className="notice" role="status">
          Authentication is not configured yet. A Supabase project URL and
          publishable key are required.
        </div>
      )}

      <div
        className="provider-actions"
        role="group"
        aria-label="Sign-in options"
        aria-busy={busy}
      >
        {PROVIDERS.map(({ id, name }) => (
          <button
            key={id}
            type="button"
            className={`provider-button provider-${id}`}
            disabled={!client || busy}
            onClick={() => void onProvider(id)}
          >
            {pendingProvider === id
              ? `Connecting to ${name}…`
              : `Continue with ${name}`}
          </button>
        ))}
      </div>

      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}

      <p className="muted fine-print">
        Your provider shares your name and email address with Daydle. Your email
        is never shown on your public profile. If you use Apple&rsquo;s Hide My
        Email, Daydle only sees Apple&rsquo;s private relay address.
      </p>
    </section>
  );
}
