import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authCallbackDestination, exchangeAuthCode } from "../lib/auth-actions";
import { pendingFriendStorage, takePendingFriendCode } from "../lib/social-api";

// React StrictMode mounts effects twice in development. OAuth authorization
// codes are single-use, so both effects must await the same exchange request.
const pendingExchanges = new Map<string, Promise<void>>();

export function exchangeCallbackOnce(
  client: SupabaseClient,
  code: string,
): Promise<void> {
  const pending = pendingExchanges.get(code);
  if (pending) return pending;

  const next = exchangeAuthCode(client, code);
  pendingExchanges.set(code, next);
  void next.then(
    () => {
      pendingExchanges.delete(code);
    },
    () => {
      pendingExchanges.delete(code);
    },
  );
  return next;
}

export function AuthCallback({ client }: { client: SupabaseClient | null }) {
  const [error, setError] = useState("");

  useEffect(() => {
    if (!client) {
      return;
    }
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const providerError =
      params.get("error_description") ?? params.get("error");
    const code = params.get("code");

    if (providerError) {
      setError(
        "Authentication was canceled or declined. Please sign in again.",
      );
    } else if (!code) {
      setError(
        "The callback is missing its authorization code. Please sign in again.",
      );
    } else {
      void exchangeCallbackOnce(client, code)
        .then(() => {
          if (active) {
            const fallback = authCallbackDestination(window.location.search);
            const pending = takePendingFriendCode(pendingFriendStorage());
            window.location.replace(pending && fallback === "/account" ? "/friends?code=" + pending : fallback);
          }
        })
        .catch(() => {
          if (active)
            setError(
              "The sign-in link has expired or could not be verified. Please try again.",
            );
        });
    }

    return () => {
      active = false;
    };
  }, [client]);

  return (
    <section aria-labelledby="callback-title" className="panel">
      <h1 id="callback-title">Confirming sign-in</h1>
      {!client ? (
        <p role="alert">
          Authentication is not configured. Contact the site administrator.
        </p>
      ) : error ? (
        <>
          <p role="alert">{error}</p>
          <a href="/auth">Return to sign in</a>
        </>
      ) : (
        <p role="status" aria-live="polite">
          Verifying your account…
        </p>
      )}
    </section>
  );
}
