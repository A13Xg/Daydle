/** Public data-handling summary. Operational and legal signoff is required
 * before a public beta release; no private data is fetched to render it. */
export function PrivacyPage() {
  return (
    <div className="catalog-page">
      <header className="catalog-heading">
        <p className="eyebrow">Your data</p>
        <h1>Privacy and data handling</h1>
        <p className="lead">
          Daydle helps you track games played on independent publisher websites.
          Your account information and public game activity are handled
          separately.
        </p>
      </header>

      <section className="panel" aria-labelledby="privacy-public">
        <h2 id="privacy-public">What other players can see</h2>
        <p>
          Your display name, public player profile, chosen games, achievements,
          and permitted game-specific results and comparisons can be viewed by
          others, including people who are not your friends. Current-puzzle
          details are hidden until the viewer has submitted their own result for
          that puzzle or the publisher’s next release has been verified.
        </p>
        <p>
          Your sign-in email address, private share text, and administrative
          information are not part of your public profile.
        </p>
      </section>

      <section className="panel" aria-labelledby="privacy-login">
        <h2 id="privacy-login">Sign-in and connected sites</h2>
        <p>
          Apple or Google sign-in manages your Daydle identity through Supabase
          Auth. Daydle does not need a separate password from you. Publisher
          games open outside Daydle and are governed by each publisher’s own
          terms and privacy practices. Daydle does not sign you in to those
          games or verify gameplay against publisher accounts.
        </p>
      </section>

      <section className="panel" aria-labelledby="privacy-paste">
        <h2 id="privacy-paste">Result submissions</h2>
        <p>
          Reading or typing in the Paste Results dialog does not upload your
          clipboard. Choosing Submit result explicitly sends that one share text
          to Daydle for deterministic parsing. Confidently parsed results are
          saved to your account; bounded unknown, ambiguous, or malformed shares
          may also be retained privately for troubleshooting and authorized
          parser review.
        </p>
        <p>
          Original share text has a maximum retention period of 90 days.
          Structured saved results and permitted statistics remain until
          deleted. Expired raw shares are excluded from export and review;
          physical removal also requires the scheduled cleanup service.
        </p>
      </section>

      <section className="panel" aria-labelledby="privacy-control">
        <h2 id="privacy-control">Your account controls</h2>
        <p>
          In Account, you can download an export of your saved information,
          delete individual results from History, or request permanent account
          deletion. A complete export may include the original share text still
          within its retention window. Keep exported files private.
        </p>
        <p>
          Account deletion removes active account records and related
          relationships. Encrypted backups, if retained, have separate
          expiration and recovery requirements; restores must not reactivate
          previously deleted accounts or expired share text.
        </p>
        <a className="secondary-link" href="/account">
          Manage my account and exports
        </a>
      </section>

      <section className="panel" aria-labelledby="privacy-security">
        <h2 id="privacy-security">Security and service diagnostics</h2>
        <p>
          Daydle uses access controls to separate public game data, your private
          records, and restricted operator tools. Basic service and parser
          diagnostics help investigate failures without publishing raw clipboard
          text or authentication credentials in general logs.
        </p>
      </section>
    </div>
  );
}
