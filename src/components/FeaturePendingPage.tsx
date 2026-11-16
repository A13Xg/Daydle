import { ArcadeIcon } from "./ArcadeIcon";

function StatisticsPreview() {
  const metrics = [
    { label: "Total solved", detail: "Statistics coming in a later phase" },
    { label: "Win rate", detail: "Game-specific results only" },
    { label: "Average speed", detail: "For puzzles that report time" },
    { label: "Flawless runs", detail: "Based on supported game formats" },
  ] as const;

  return (
    <section className="statistics-preview" aria-labelledby="feature-title">
      <header className="stats-introduction">
        <p className="eyebrow">ARCADE PERFORMANCE</p>
        <h1 id="feature-title">Your statistics</h1>
        <p>
          Saved results are available in your private History. Personal statistics and achievements will be enabled in a later phase.
        </p>
      </header>
      <section
        className="panel stats-overview"
        aria-labelledby="stats-metrics-heading"
      >
        <div className="stats-section-title">
          <div className="stats-section-label">
            <ArcadeIcon name="spark" size={22} />
            <h2 id="stats-metrics-heading">Master Metrics</h2>
          </div>
          <span className="status-pill">Coming later</span>
        </div>
        <div className="stats-metric-grid">
          {metrics.map(({ label, detail }) => (
            <article className="stats-metric" key={label}>
              <h3>{label}</h3>
              <p className="stats-unavailable" aria-label="Not available">
                —
              </p>
              <small>{detail}</small>
            </article>
          ))}
        </div>
      </section>
      <section
        className="panel stats-distribution"
        aria-labelledby="distribution-heading"
      >
        <div className="stats-section-label">
          <ArcadeIcon name="statistics" size={22} />
          <h2 id="distribution-heading">Guess Distribution</h2>
        </div>
        <div className="stats-distribution-empty">
          <ArcadeIcon name="info" size={24} />
          <p>
            This statistics view is not available yet. Saved results can be reviewed in History; game-specific distributions are scheduled for a later phase.
          </p>
        </div>
      </section>
      <div className="feature-links">
        <a className="action-link" href="/today">
          Go to Today <ArcadeIcon name="arrow" size={17} />
        </a>
        <a className="secondary-link" href="/games">
          Discover games
        </a>
      </div>
    </section>
  );
}

export function FeaturePendingPage({
  feature,
}: {
  feature: "statistics" | "friends" | "notifications";
}) {
  if (feature === "statistics") return <StatisticsPreview />;

  const options = {
    statistics: {
      title: "Your statistics",
      icon: "statistics" as const,
      heading: "Every puzzle tells a story.",
      description:
        "After personal statistics become available, this space will show game-by-game progress, streaks, and achievements.",
    },
    friends: {
      title: "Friends & rivalry",
      icon: "friends" as const,
      heading: "Better puzzles, together.",
      description:
        "Friend codes, comparisons and spoiler-safe scoreboards will arrive in later phases. Your account's friend code is available in Account.",
    },
    notifications: {
      title: "Notifications",
      icon: "bell" as const,
      heading: "Nothing to notify yet.",
      description:
        "Notifications are not enabled. No background alerts or reminder schedules have been configured.",
    },
  }[feature];
  return (
    <section className="feature-pending" aria-labelledby="feature-title">
      <div className="feature-pending-icon">
        <ArcadeIcon name={options.icon} size={38} />
      </div>
      <p className="eyebrow">DAYDLE ARCADE</p>
      <h1 id="feature-title">{options.title}</h1>
      <h2>{options.heading}</h2>
      <p>{options.description}</p>
      <div className="feature-links">
        <a className="action-link" href="/today">
          Go to Today <ArcadeIcon name="arrow" size={17} />
        </a>
        <a className="secondary-link" href="/games">
          Discover games
        </a>
      </div>
    </section>
  );
}

export function HowItWorksPage() {
  return (
    <div className="how-page">
      <p className="eyebrow">YOUR DAILY RITUAL</p>
      <h1>Play anywhere. Track it here.</h1>
      <p className="lead">
        Daydle gathers your favorite daily puzzles in one place without hosting
        the games themselves.
      </p>
      <ol className="how-steps">
        <li className="panel">
          <span className="step-number">01</span>
          <h2>Build your lineup</h2>
          <p>
            Choose games from Discover. Your lineup stays in your preferred
            order.
          </p>
        </li>
        <li className="panel">
          <span className="step-number">02</span>
          <h2>Play at the publisher</h2>
          <p>
            Open a game, solve it there, then return to Daydle. Browser return
            behavior varies by device.
          </p>
        </li>
        <li className="panel">
          <span className="step-number">03</span>
          <h2>Bring your share text</h2>
          <p>
            Use Paste Results after copying a share message. Supported formats are recognized when you select Submit result, then saved to private History. Unknown-format samples are only retained after separate consent.
          </p>
        </li>
      </ol>
      <a className="action-link how-start" href="/today">
        Open Today <ArcadeIcon name="arrow" size={18} />
      </a>
    </div>
  );
}
