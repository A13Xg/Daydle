import { ArcadeIcon } from "./ArcadeIcon";

export function FeaturePendingPage({
  feature,
}: {
  feature: "statistics" | "friends" | "notifications";
}) {
  const options = {
    statistics: {
      title: "Your statistics",
      icon: "statistics" as const,
      heading: "Every puzzle tells a story.",
      description:
        "Game-specific stats, activity streaks and achievements will appear here after result saving is available. No results or rankings are fabricated.",
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
      <div className="feature-pending-icon"><ArcadeIcon name={options.icon} size={38} /></div>
      <p className="eyebrow">DAYDLE ARCADE</p>
      <h1 id="feature-title">{options.title}</h1>
      <h2>{options.heading}</h2>
      <p>{options.description}</p>
      <div className="feature-links">
        <a className="action-link" href="/today">Go to Today <ArcadeIcon name="arrow" size={17} /></a>
        <a className="secondary-link" href="/games">Discover games</a>
      </div>
    </section>
  );
}

export function HowItWorksPage() {
  return (
    <div className="how-page">
      <p className="eyebrow">YOUR DAILY RITUAL</p>
      <h1>Play anywhere. Track it here.</h1>
      <p className="lead">Daydle gathers your favorite daily puzzles in one place without hosting the games themselves.</p>
      <ol className="how-steps">
        <li className="panel"><span className="step-number">01</span><h2>Build your lineup</h2><p>Choose games from Discover. Your lineup stays in your preferred order.</p></li>
        <li className="panel"><span className="step-number">02</span><h2>Play at the publisher</h2><p>Open a game, solve it there, then return to Daydle. Browser return behavior varies by device.</p></li>
        <li className="panel"><span className="step-number">03</span><h2>Bring your share text</h2><p>Use Paste Results after copying a share message. Automatic recognition and saving are coming in a later phase; nothing uploads yet.</p></li>
      </ol>
      <a className="action-link how-start" href="/today">Open Today <ArcadeIcon name="arrow" size={18} /></a>
    </div>
  );
}
