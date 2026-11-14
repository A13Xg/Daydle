import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loginEmail,
  registerEmail,
  sendPasswordRecovery,
  startOAuth,
  type OAuthProvider,
} from "../lib/auth-actions";

type Mode = "sign-in" | "sign-up" | "recover";

interface AuthPageProps {
  client: SupabaseClient | null;
  signedIn: boolean;
}

export function AuthPage({ client, signedIn }: AuthPageProps) {
  const requestedMode = new URLSearchParams(window.location.search).get("mode");
  const [mode, setMode] = useState<Mode>(
    requestedMode === "signup"
      ? "sign-up"
      : requestedMode === "recover"
        ? "recover"
        : "sign-in",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || pending) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      if (mode === "sign-up") {
        const outcome = await registerEmail(
          client,
          email,
          password,
          displayName,
          window.location.origin,
        );
        if (outcome === "signed-in") {
          window.location.assign("/account");
        } else {
          setNotice(
            "Check your email to confirm your account before signing in.",
          );
        }
      } else if (mode === "recover") {
        await sendPasswordRecovery(client, email, window.location.origin);
        setNotice(
          "If this email has an account, a password reset link will be sent.",
        );
      } else {
        await loginEmail(client, email, password);
        window.location.assign("/account");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Authentication failed. Please retry.",
      );
    } finally {
      setPending(false);
    }
  }

  async function onProvider(provider: OAuthProvider) {
    if (!client || pending) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const url = await startOAuth(client, provider, window.location.origin);
      window.location.assign(url);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to connect to the provider.",
      );
      setPending(false);
    }
  }

  if (signedIn) {
    return (
      <section aria-labelledby="auth-title" className="panel">
        <h1 id="auth-title">You are signed in</h1>
        <p>Manage your profile and friend code from your account.</p>
        <a href="/account">Go to my account</a>
      </section>
    );
  }

  return (
    <section aria-labelledby="auth-title" className="panel auth-panel">
      <h1 id="auth-title">
        {mode === "sign-up"
          ? "Create your account"
          : mode === "recover"
            ? "Reset your password"
            : "Sign in to Daydle"}
      </h1>
      <p>
        {mode === "sign-up"
          ? "Choose a display name and email address to begin."
          : mode === "recover"
            ? "Enter the email you use for Daydle."
            : "Continue tracking your games and statistics."}
      </p>

      {!client && (
        <div className="notice" role="status">
          Authentication is not configured yet. A Supabase project URL and
          publishable key are required.
        </div>
      )}

      <form onSubmit={(event) => void onSubmit(event)} aria-busy={pending}>
        {mode === "sign-up" && (
          <div className="field">
            <label htmlFor="signup-name">Display name</label>
            <input
              id="signup-name"
              name="displayName"
              type="text"
              autoComplete="nickname"
              required
              minLength={1}
              maxLength={80}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={!client || pending}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!client || pending}
          />
        </div>
        {mode !== "recover" && (
          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              name="password"
              type="password"
              minLength={mode === "sign-up" ? 8 : undefined}
              autoComplete={
                mode === "sign-up" ? "new-password" : "current-password"
              }
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={!client || pending}
            />
          </div>
        )}

        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}

        <button type="submit" disabled={!client || pending}>
          {pending
            ? "Working…"
            : mode === "sign-up"
              ? "Create account"
              : mode === "recover"
                ? "Send reset link"
                : "Sign in"}
        </button>
      </form>

      {mode !== "recover" && (
        <div className="oauth-actions">
          <p className="muted">Or continue with</p>
          <button
            type="button"
            disabled={!client || pending}
            onClick={() => void onProvider("apple")}
          >
            Apple
          </button>
          <button
            type="button"
            disabled={!client || pending}
            onClick={() => void onProvider("google")}
          >
            Google
          </button>
        </div>
      )}

      <nav className="auth-navigation" aria-label="Account options">
        {mode !== "sign-in" && (
          <button type="button" onClick={() => switchMode("sign-in")}>
            Sign in
          </button>
        )}
        {mode !== "sign-up" && (
          <button type="button" onClick={() => switchMode("sign-up")}>
            Create account
          </button>
        )}
        {mode !== "recover" && (
          <button type="button" onClick={() => switchMode("recover")}>
            Forgot password?
          </button>
        )}
      </nav>
    </section>
  );
}
