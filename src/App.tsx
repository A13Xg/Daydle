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
import { ShareTutorial } from "./components/ShareTutorial";
import { markShareTutorialSeen, shouldShowShareTutorial } from "./lib/share-tutorial";
import { HistoryPage } from "./components/HistoryPage";
import { StatisticsPage } from "./components/StatisticsPage";
import { FriendsPage } from "./components/FriendsPage";
import { PublicPlayerPage } from "./components/PublicPlayerPage";
import { GameRequestsPage } from "./components/GameRequestsPage";
import { AdminPage } from "./components/AdminPage";
import { PrivacyPage } from "./components/PrivacyPage";
import {
  ComparisonsPage,
  PublicResultDetail,
} from "./components/ComparisonsPage";
import {
  ArcadeHeader,
  ArcadePasteAction,
  ArcadeTabBar,
  shellForPath,
} from "./components/ArcadeShell";
import {
  FeaturePendingPage,
  HowItWorksPage,
} from "./components/FeaturePendingPage";

type HealthStatus = "checking" | "ready" | "unavailable";

function localStorageAvailable(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

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
  const shell = shellForPath(pathname);
  const catalogDetail = pathname.match(/^\/games\/([a-z0-9-]+)\/?$/);
  const playerId = pathname.match(/^\/players\/([0-9a-f-]{36})\/?$/i)?.[1];
  const comparisonResultId = pathname.match(
    /^\/comparison-results\/([0-9a-f-]{36})\/?$/i,
  )?.[1];
  const [pasteOpen, setPasteOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const tutorialShownFor = useRef<Set<string>>(new Set());
  const [returnPrompt, setReturnPrompt] = useState(false);
  const [health, setHealth] = useState<HealthStatus>("checking");
  const [healthRetry, setHealthRetry] = useState(0);
  const pasteTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!userId) {
      setTutorialOpen(false);
      return;
    }
    if (pathname === "/auth/callback" || tutorialShownFor.current.has(userId))
      return;
    tutorialShownFor.current.add(userId);
    setTutorialOpen(shouldShowShareTutorial(localStorageAvailable(), userId));
  }, [userId, pathname]);

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

  useEffect(() => {
    if (!pasteOpen && !tutorialOpen) return;
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prior;
    };
  }, [pasteOpen, tutorialOpen]);

  function closeTutorial() {
    markShareTutorialSeen(localStorageAvailable(), userId);
    setTutorialOpen(false);
  }

  function openPaste() {
    clearPublisherLaunch(sessionStorageAvailable());
    setReturnPrompt(false);
    setPasteOpen(true);
  }

  function closePaste() {
    setPasteOpen(false);
    requestAnimationFrame(() => pasteTrigger.current?.focus());
  }

  function page() {
    if (pathname === "/auth/callback") return <AuthCallback client={client} />;
    if (pathname === "/auth")
      return <AuthPage client={client} signedIn={authenticated} />;
    if (pathname === "/games" || catalogDetail || pathname === "/lineup")
      return (
        <CatalogPage
          key={userId ?? "anonymous"}
          client={client}
          userId={userId}
          detailSlug={catalogDetail?.[1]}
          lineupOnly={pathname === "/lineup"}
        />
      );
    if (pathname === "/requests")
      return <GameRequestsPage client={client} userId={userId} />;
    if (pathname === "/admin") {
      return client ? (
        <AdminPage client={client} userId={userId} />
      ) : (
        <section className="panel" role="status">
          <h1>Administration unavailable</h1>
          <p>Administrator services are not configured. Try again later.</p>
        </section>
      );
    }
    if (pathname === "/history")
      return (
        <HistoryPage
          key={userId ?? "anonymous"}
          client={client}
          userId={userId}
        />
      );
    if (pathname === "/account")
      return (
        <AccountPage
          key={userId ?? "signed-out"}
          client={client}
          user={authenticated ? authState.session.user : null}
          loadingSession={authState.status === "loading"}
        />
      );
    if (pathname === "/statistics")
      return (
        <StatisticsPage
          key={userId ?? "anonymous"}
          client={client}
          userId={userId}
        />
      );
    if (pathname === "/friends")
      return (
        <FriendsPage key={userId ?? "guest"} client={client} userId={userId} />
      );
    if (playerId)
      return (
        <PublicPlayerPage
          key={playerId}
          id={playerId}
          client={client}
          viewerId={userId}
        />
      );
    if (pathname === "/compare")
      return <ComparisonsPage client={client} userId={userId} />;
    if (comparisonResultId)
      return (
        <PublicResultDetail
          id={comparisonResultId}
          client={client}
          userId={userId}
        />
      );
    if (pathname === "/notifications")
      return <FeaturePendingPage feature="notifications" />;
    if (pathname === "/how-it-works") return <HowItWorksPage />;
    if (pathname === "/privacy") return <PrivacyPage />;
    if (pathname === "/" || pathname === "/today" || pathname === "/today/")
      return (
        <TodayPage
          key={userId ?? "anonymous"}
          client={client}
          userId={userId}
          suspendEmptyRedirect={tutorialOpen}
        />
      );
    return (
      <section className="panel" role="status">
        <h1>Page not found</h1>
        <p>That route isn't part of the Daydle arcade.</p>
        <a href="/today">Return to Today</a>
      </section>
    );
  }

  return (
    <div className={`app shell-${shell}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <ArcadeHeader
        pathname={pathname}
        signedIn={authenticated}
        onPaste={openPaste}
        pasteTrigger={pasteTrigger}
      />
      {returnPrompt && !pasteOpen && shell !== "blank" && (
        <aside className="return-banner" role="status">
          <p>
            Back from a game? Paste a copied share result when you're ready.
            Clipboard access always requires another tap.
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
      <main id="main" className={`content content-${shell}`}>
        {page()}
      </main>
      {shell !== "blank" && (
        <footer className="site-footer">
          <small>
            Publisher games open externally. Manual play markers are not
            verified results.
          </small>
          <a className="secondary-link" href="/privacy">
            Privacy and data handling
          </a>
          {health === "unavailable" && (
            <span role="alert" className="health-warning">
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
      )}
      {shell === "tab" && !pasteOpen && (
        <>
          <ArcadePasteAction onPaste={openPaste} pasteTrigger={pasteTrigger} />
          <ArcadeTabBar pathname={pathname} />
        </>
      )}
      {pasteOpen && (
        <PasteDialog
          key={userId ?? "anonymous"}
          onClose={closePaste}
          client={client}
          userId={userId}
        />
      )}
      {tutorialOpen && !pasteOpen && (
        <ShareTutorial onDone={closeTutorial} />
      )}
    </div>
  );
}
