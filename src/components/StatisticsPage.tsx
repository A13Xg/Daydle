import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonalStatistics } from "../../shared/statistics";
import { loadPersonalStatistics } from "../lib/statistics-api";
import { resultErrorText } from "../lib/results-api";
import { ArcadeIcon } from "./ArcadeIcon";

type StatsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: PersonalStatistics };

function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function StatisticsPage({
  client,
  userId,
}: {
  client: SupabaseClient | null;
  userId: string | null;
}) {
  const [state, setState] = useState<StatsState>({ status: "loading" });
  const [refresh, setRefresh] = useState(0);
  const [timezone] = useState(localTimezone);
  const [selectedGame, setSelectedGame] = useState("");
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );

  useEffect(() => {
    function updateOnline() {
      setOnline(navigator.onLine);
    }
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!client || !userId) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    void loadPersonalStatistics(client, userId, timezone, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: "ready", data });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: resultErrorText(cause) });
        }
      });
    return () => controller.abort();
  }, [client, userId, timezone, refresh]);

  if (!client || !userId) {
    return (
      <section className="statistics-preview" aria-labelledby="feature-title">
        <header className="stats-introduction">
          <p className="eyebrow">ARCADE PERFORMANCE</p>
          <h1 id="feature-title">Your statistics</h1>
          <p>Sign in to see your recorded puzzle progress and achievements.</p>
        </header>
        <a className="action-link" href="/auth">
          Sign in <ArcadeIcon name="arrow" size={17} />
        </a>
      </section>
    );
  }

  const stats = state.status === "ready" ? state.data : null;
  const game = stats?.games.find((item) => item.slug === selectedGame) ??
    stats?.games[0];
  const metrics = stats
    ? [
        { label: "Results recorded", value: stats.totalResults },
        { label: "Days active", value: stats.daysActive },
        { label: "Current streak", value: stats.currentStreak },
        { label: "Longest streak", value: stats.longestStreak },
      ]
    : [];

  return (
    <section className="statistics-preview" aria-labelledby="feature-title">
      <header className="stats-introduction">
        <p className="eyebrow">ARCADE PERFORMANCE</p>
        <h1 id="feature-title">Your statistics</h1>
        <p>
          Personal progress from saved publisher results. Activity is grouped
          by submission day in {timezone}.
        </p>
      </header>
      {!online && (
        <p className="notice" role="status">
          You are offline. Private statistics require a connection and are
          not cached on this device.
        </p>
      )}
      {state.status === "loading" && (
        <div className="panel" role="status">
          Loading your statistics…
        </div>
      )}
      {state.status === "error" && (
        <div className="panel" role="alert">
          <p>{state.message}</p>
          <button
            type="button"
            disabled={!online}
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {stats && (
        <>
          <section className="panel stats-overview" aria-labelledby="stats-metrics-heading">
            <div className="stats-section-title">
              <div className="stats-section-label">
                <ArcadeIcon name="spark" size={22} />
                <h2 id="stats-metrics-heading">Master Metrics</h2>
              </div>
              <button
                type="button"
                disabled={!online}
                onClick={() => setRefresh((value) => value + 1)}
              >
                <ArcadeIcon name="refresh" size={17} /> Refresh
              </button>
            </div>
            <div className="stats-metric-grid">
              {metrics.map(({ label, value }) => (
                <article className="stats-metric" key={label}>
                  <h3>{label}</h3>
                  <p>{value.toLocaleString()}</p>
                </article>
              ))}
            </div>
          </section>
          {stats.totalResults === 0 ? (
            <div className="panel stats-distribution-empty">
              <p>No recorded results yet. Submit a supported publisher share
                through Paste Results to start tracking progress.</p>
              <a href="/games">Discover supported games</a>
            </div>
          ) : (
            <>
              <section
                className="panel stats-distribution"
                aria-labelledby="distribution-heading"
              >
                <div className="stats-section-label">
                  <ArcadeIcon name="statistics" size={22} />
                  <h2 id="distribution-heading">Game performance</h2>
                </div>
                <label htmlFor="stats-game">Choose game</label>
                <select
                  id="stats-game"
                  value={game?.slug ?? ""}
                  onChange={(event) => setSelectedGame(event.target.value)}
                >
                  {stats.games.map((item) => (
                    <option value={item.slug} key={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {game && (
                  <div>
                    <p>
                      {game.recorded} results · {game.completed} completed ·
                      {" "}{game.lost} not solved
                    </p>
                    <p>
                      Completion rate:{" "}
                      {game.completionRate === null
                        ? "Unavailable"
                        : (100 * game.completionRate).toFixed(1) + "%"}
                    </p>
                    <p>
                      Best attempts: {game.bestAttempts ?? "Unavailable"}
                      {" · "}Best time:{" "}
                      {game.bestTimeMs === null
                        ? "Unavailable"
                        : (game.bestTimeMs / 1000).toFixed(1) + "s"}
                    </p>
                    <h3>Guess distribution</h3>
                    {game.attemptsDistribution.length ? (
                      <ol>
                        {game.attemptsDistribution.map((entry) => (
                          <li key={entry.attempts}>
                            {entry.attempts} attempts: {entry.count}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p>No compatible attempt counts recorded.</p>
                    )}
                  </div>
                )}
              </section>
              <section className="panel" aria-labelledby="achievements-heading">
                <h2 id="achievements-heading">Achievements</h2>
                {stats.achievements.length ? (
                  <ul>
                    {stats.achievements.map((item) => (
                      <li key={item.code}>
                        <strong>{item.name}</strong> — {item.description}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Your first recorded result unlocks an achievement.</p>
                )}
              </section>
            </>
          )}
          <p className="muted">
            Your statistics are recalculated from current saved results.
            Corrections and deletions change your totals. Changing timezones
            may change historical activity-day grouping.
          </p>
          <a className="secondary-link" href="/history">
            View result history
          </a>
        </>
      )}
    </section>
  );
}
