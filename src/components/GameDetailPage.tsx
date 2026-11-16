import type { CatalogGame } from "../../shared/catalog";
import {
  canAddGame, canLaunchGame, gameAvailabilityLabel, parserSupportLabel,
  safePublisherUrl,
} from "../../shared/catalog";

export interface GameDetailPageProps {
  game: CatalogGame;
  selected: boolean;
  signedIn: boolean;
  saving: boolean;
  onToggle: (id: string) => void;
}

export function GameDetailPage({
  game, selected, signedIn, saving, onToggle,
}: GameDetailPageProps) {
  const href = safePublisherUrl(game.canonicalUrl);
  const launchable = canLaunchGame(game);
  return (
    <article className="panel game-detail">
      <a href="/games">Back to all games</a>
      <h1>{game.name}</h1>
      <p>{game.description}</p>
      <dl className="catalog-metadata">
        <div><dt>Publisher</dt><dd>{game.publisher ?? "Publisher not listed"}</dd></div>
        <div><dt>Schedule</dt><dd>{game.cadence.replaceAll("_", " ")}</dd></div>
        <div><dt>Results</dt><dd>{parserSupportLabel(game.parserStatus)}</dd></div>
        <div><dt>Availability</dt><dd>{gameAvailabilityLabel(game)}</dd></div>
        <div><dt>Categories</dt><dd>{game.categorySlugs.join(", ") || "Uncategorized"}</dd></div>
      </dl>
      <div className="game-actions">
        {launchable && href ? (
          <a className="action-link" href={href} target="_blank" rel="noopener noreferrer">
            Play at publisher
          </a>
        ) : (
          <span className="notice" role="status">
            Publisher link unavailable. This game cannot be launched from Daydle.
          </span>
        )}
        {signedIn ? (
          <button type="button" disabled={saving || (!selected && !canAddGame(game))}
            onClick={() => onToggle(game.id)}>
            {selected ? "Remove from my games" : "Add to my games"}
          </button>
        ) : (
          <a href="/auth">Sign in to save this game</a>
        )}
      </div>
      <p className="fine-print">Game is played on the publisher's site. Daydle does not host or
        reproduce its puzzles. Results tracking requires a verified parser, added in a later phase.</p>
    </article>
  );
}
