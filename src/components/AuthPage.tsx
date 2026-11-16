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

function ProviderMark({ provider }: { provider: OAuthProvider }) {
  if (provider === "apple") {
    return (
      <svg aria-hidden="true" focusable="false" className="provider-mark" viewBox="0 0 170 170" fill="currentColor">
        <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.94-14.3-6.52-9.9-11.53-21.2-15.02-33.91-3.5-12.71-5.25-24.3-5.25-34.78 0-14.79 3.73-26.68 11.2-35.67 7.46-8.98 16.63-13.56 27.5-13.73 4.8 0 10.3 1.25 16.51 3.77 6.2 2.51 10.15 3.84 11.83 3.99 1.34-.15 5.46-1.56 12.37-4.23 6.91-2.67 12.59-3.84 17.06-3.52 12.63.78 22.86 5.56 30.68 14.35-11.19 6.8-16.68 16.27-16.47 28.42.21 9.53 3.96 17.5 11.27 23.91 7.31 6.41 16.03 10.14 26.16 11.19-2.23 6.8-4.91 13.7-8.03 20.7zM119.22 33.15c0-7.39 2.68-14.51 8.05-21.36 5.37-6.85 12.02-11.13 19.95-12.83.67 1.56 1.01 3.24 1.01 5.03 0 7.39-2.79 14.56-8.38 21.51-5.59 6.95-12.44 11.16-20.55 12.63-.08-1.68-.08-3.34-.08-4.98z"/>
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" focusable="false" className="provider-mark" viewBox="0 0 24 24">
      <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" fill="#4285F4"/>
      <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" fill="#34A853"/>
      <path d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z" fill="#FBBC05"/>
      <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" fill="#EA4335"/>
    </svg>
  );
}

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
    } catch {
      // Fixed text: provider and Supabase error messages can expose configuration details.
      setError(
        "We couldn't start sign-in with that provider. Please try again in a moment.",
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
    <section aria-labelledby="auth-title" className="auth-page">
      <header className="auth-introduction">
        <div className="auth-hero-mark">
          <img src="/arcade-emblem.svg" width="82" height="82" alt="" />
        </div>
        <div className="auth-wordmark">
          <span>Daydle</span>
          <span className="auth-wordmark-badge">ARCADE</span>
        </div>
        <p className="auth-trust-ribbon"><span aria-hidden="true" className="auth-trust-dot" /> Your daily puzzles · Your pace</p>
        <h1 id="auth-title">Master Your Daily Ritual.</h1>
        <p className="auth-intro-copy">
          Discover your favorite daily puzzles, build your lineup, and return to Daydle after playing at the publisher.
        </p>
      </header>

      <div className="auth-signin">
        {!client && (
          <div className="notice" role="status">
            Authentication is not configured yet. A Supabase project URL and publishable key are required.
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
              <ProviderMark provider={id} />
              <span>{pendingProvider === id
                ? `Connecting to ${name}…`
                : id === "apple" ? "Sign in with Apple" : "Continue with Google"}</span>
            </button>
          ))}
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <p className="auth-signin-helper">Your existing Apple or Google account can be used to sign in or create a Daydle account.</p>
      </div>

      <p className="muted fine-print auth-privacy">
        Your provider shares your name and email address with Daydle. Your name
        becomes your public display name, which anyone can see, and you can
        change it on your account page. Your email is never shown. If you use
        Apple&rsquo;s Hide My Email, Daydle only sees Apple&rsquo;s private
        relay address.
      </p>
    </section>
  );
}
