import { useEffect, useState } from "react";
import { readPublicSupabaseConfig } from "./lib/config";
import { readTurnstileSiteKey } from "./lib/captcha";
import { fetchHealth } from "./lib/api";
import { browserAuthClient } from "./lib/browser-auth";
import { useAuthSession } from "./lib/use-auth";
import { AuthPage } from "./components/AuthPage";
import { AuthCallback } from "./components/AuthCallback";
import { AccountPage } from "./components/AccountPage";

type ServiceStatus = "loading" | "ready" | "unavailable";

export default function App() {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const supabase = readPublicSupabaseConfig(import.meta.env);
  const client = browserAuthClient();
  const authState = useAuthSession(client);
  const pathname = window.location.pathname;
  const authenticated = authState.status === "signed-in";

  useEffect(() => {
    const controller = new AbortController();

    fetchHealth(controller.signal)
      .then(() => setServiceStatus("ready"))
      .catch(() => {
        if (!controller.signal.aborted) setServiceStatus("unavailable");
      });

    return () => controller.abort();
  }, [attempt]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a href="/" className="brand">
          Daydle
        </a>
        <nav aria-label="Primary navigation">
          <a href={authenticated ? "/account" : "/auth"}>
            {authenticated ? "Account" : "Sign in"}
          </a>
        </nav>
      </header>

      <main id="main" className="content">
        {pathname === "/auth/callback" ? (
          <AuthCallback client={client} />
        ) : pathname === "/auth" ? (
          <AuthPage
            client={client}
            signedIn={authenticated}
            captchaSiteKey={readTurnstileSiteKey(import.meta.env)}
          />
        ) : pathname === "/account" ? (
          <AccountPage
            client={client}
            user={authenticated ? authState.session.user : null}
            loadingSession={authState.status === "loading"}
          />
        ) : (
          <>
            <h1>All your daily games. One place.</h1>
            <p className="lead">
              Daydle's account foundation is taking shape. Game discovery, daily
              results and friends will be added in subsequent phases.
            </p>
            <section aria-labelledby="foundation-heading" className="panel">
              <h2 id="foundation-heading">Environment readiness</h2>
              <dl className="statuses">
                <div>
                  <dt>Cloudflare API</dt>
                  <dd role="status" aria-live="polite">
                    {serviceStatus === "ready"
                      ? "Available"
                      : serviceStatus === "loading"
                        ? "Checking…"
                        : "Unavailable"}
                  </dd>
                </div>
                <div>
                  <dt>Supabase public configuration</dt>
                  <dd>
                    {supabase.status === "configured"
                      ? "Configured (connection not tested)"
                      : supabase.status === "unconfigured"
                        ? "Not configured"
                        : "Configuration invalid"}
                  </dd>
                </div>
                <div>
                  <dt>Authentication</dt>
                  <dd role="status">
                    {authenticated
                      ? "Signed in"
                      : authState.status === "loading"
                        ? "Restoring…"
                        : "Not signed in"}
                  </dd>
                </div>
              </dl>
              {serviceStatus === "unavailable" && (
                <div className="notice" role="alert">
                  <p>
                    The API could not be reached. Verify the development server
                    and try again.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setServiceStatus("loading");
                      setAttempt((current) => current + 1);
                    }}
                  >
                    Retry API check
                  </button>
                </div>
              )}
              {supabase.status === "invalid" && (
                <p className="notice" role="status">
                  {supabase.reason}
                </p>
              )}
              {authState.status === "error" && (
                <p className="notice error" role="alert">
                  {authState.message}
                </p>
              )}
            </section>
            <section aria-labelledby="next-heading" className="panel">
              <h2 id="next-heading">Coming in later phases</h2>
              <ul>
                <li>Browse and select daily games.</li>
                <li>Paste and track results.</li>
                <li>Compare scores, trends, and achievements.</li>
              </ul>
            </section>
          </>
        )}
      </main>
      <footer className="site-footer">
        <p>Public beta foundation — game results are not active yet.</p>
      </footer>
    </div>
  );
}
