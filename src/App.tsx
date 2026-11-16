import { useEffect, useRef, useState } from "react";
import { fetchHealth } from "./lib/api";
import { browserAuthClient } from "./lib/browser-auth";
import { useAuthSession } from "./lib/use-auth";
import { readPublisherLaunch, clearPublisherLaunch } from "./lib/launch-return";
import { AuthPage } from "./components/AuthPage";
import { AuthCallback } from "./components/AuthCallback";
import { AccountPage } from "./components/AccountPage";
import { CatalogPage } from "./components/CatalogPage";
import { TodayPage } from "./components/TodayPage";
import { PasteDialog } from "./components/PasteDialog";

type HealthStatus = "checking" | "ready" | "unavailable";

function sessionStorageAvailable(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

export default function App() {
  const client = browserAuthClient();
  const authState = useAuthSession(client);
  const authenticated = authState.status === "signed-in";
  const userId = authenticated ? authState.session.user.id : null;
  const pathname = window.location.pathname;
  const catalogDetail = pathname.match(/^\/games\/([a-z0-9-]+)\/?$/);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [returnPrompt, setReturnPrompt] = useState(false);
  const [health, setHealth] = useState<HealthStatus>("checking");
  const [healthRetry, setHealthRetry] = useState(0);
  const pasteTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal).then(
      () => setHealth("ready"),
      () => {
        if (!controller.signal.aborted) setHealth("unavailable");
      },
    );
    return () => controller.abort();
  }, [healthRetry]);

  useEffect(() => {
    function onResume() {
      if (document.visibilityState === "hidden") return;
      if (readPublisherLaunch(sessionStorageAvailable())) setReturnPrompt(true);
    }
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, []);

  function openPaste() {
    clearPublisherLaunch(sessionStorageAvailable());
    setReturnPrompt(false);
    setPasteOpen(true);
  }

  function closePaste() {
    setPasteOpen(false);
    requestAnimationFrame(() => pasteTrigger.current?.focus());
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a href="/today" className="brand">
          Daydle
        </a>
        <nav aria-label="Primary navigation">
          <a
            href="/today"
            aria-current={
              pathname === "/" || pathname === "/today" ? "page" : undefined
            }
          >
            Today
          </a>
          <a
            href="/games"
            aria-current={pathname.startsWith("/games") ? "page" : undefined}
          >
            Games
          </a>
          <a href={authenticated ? "/account" : "/auth"}>
            {authenticated ? "Account" : "Sign in"}
          </a>
        </nav>
        <button
          type="button"
          className="paste-global"
          onClick={openPaste}
          ref={pasteTrigger}
        >
          Paste Results
        </button>
      </header>

      {returnPrompt && !pasteOpen && (
        <aside className="return-banner" role="status">
          <p>
            Back from a game? Open Paste Results when you're ready. Clipboard
            access requires a separate tap.
          </p>
          <div>
            <button type="button" onClick={openPaste}>
              Paste Results
            </button>
            <button
              type="button"
              onClick={() => {
                clearPublisherLaunch(sessionStorageAvailable());
                setReturnPrompt(false);
              }}
            >
              Dismiss
            </button>
          </div>
        </aside>
      )}

      <main id="main" className="content">
        {pathname === "/auth/callback" ? (
          <AuthCallback client={client} />
        ) : pathname === "/auth" ? (
          <AuthPage client={client} signedIn={authenticated} />
        ) : pathname === "/games" || catalogDetail ? (
          <CatalogPage
            key={userId ?? "anonymous"}
            client={client}
            userId={userId}
            detailSlug={catalogDetail?.[1]}
          />
        ) : pathname === "/account" ? (
          <AccountPage
            key={userId ?? "signed-out"}
            client={client}
            user={authenticated ? authState.session.user : null}
            loadingSession={authState.status === "loading"}
          />
        ) : (
          <TodayPage
            key={userId ?? "anonymous"}
            client={client}
            userId={userId}
          />
        )}
      </main>
      <footer className="site-footer">
        <small>
          Daydle opens games on their publisher sites. Played markers are
          manual, not verified results.
        </small>
        {health === "unavailable" && (
          <span role="alert">
            {" "}
            Daydle API unavailable.
            <button
              type="button"
              onClick={() => {
                setHealth("checking");
                setHealthRetry((n) => n + 1);
              }}
            >
              Retry
            </button>
          </span>
        )}
      </footer>
      {pasteOpen && (
        <PasteDialog key={userId ?? "anonymous"} onClose={closePaste} />
      )}
    </div>
  );
}
