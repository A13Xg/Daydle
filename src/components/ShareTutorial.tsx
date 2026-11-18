import { useEffect, useRef } from "react";
import { ArcadeIcon } from "./ArcadeIcon";

export function ShareTutorial({ onDone }: { onDone: () => void }) {
  const doneButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    doneButton.current?.focus();
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onDone();
    } else if (event.key === "Tab") {
      // The dialog has one interactive control; focus stays inside.
      event.preventDefault();
      doneButton.current?.focus();
    }
  }

  return (
    <div className="share-tour-backdrop">
      <section
        className="panel share-tour"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-tour-title"
        aria-describedby="share-tour-description"
        onKeyDown={onKeyDown}
      >
        <p className="eyebrow">WELCOME TO YOUR ARCADE</p>
        <h2 id="share-tour-title">Bring your puzzle results to Daydle</h2>
        <p id="share-tour-description" className="muted">
          Play each game on its publisher's site. Once you finish, the share
          option is the fastest way to record your result here.
        </p>
        <ol className="share-tour-steps">
          <li>
            <span className="share-tour-number">01</span>
            <div className="share-tour-visual" aria-hidden="true">
              <span className="share-tour-mini-label">At the game</span>
              <span className="share-tour-sample-button">
                <ArcadeIcon name="arrow" size={16} />
                Share Results
              </span>
            </div>
            <strong>Tap Share Results</strong>
            <span>Finish the puzzle and open its results-sharing menu.</span>
          </li>
          <li>
            <span className="share-tour-number">02</span>
            <div className="share-tour-visual" aria-hidden="true">
              <span className="share-tour-mini-label">In the share menu</span>
              <span className="share-tour-sample-button share-tour-copy">
                <ArcadeIcon name="paste" size={16} />
                Copy
                <ArcadeIcon name="check" size={16} />
              </span>
            </div>
            <strong>Choose Copy</strong>
            <span>Copy the share text, not a screenshot or game link.</span>
          </li>
          <li>
            <span className="share-tour-number">03</span>
            <div className="share-tour-visual" aria-hidden="true">
              <span className="share-tour-mini-label">Back in Daydle</span>
              <span className="share-tour-sample-button share-tour-paste">
                <ArcadeIcon name="paste" size={16} />
                Paste Results
              </span>
            </div>
            <strong>Paste, then Submit result</strong>
            <span>Paste from the clipboard and submit to save your history.</span>
          </li>
        </ol>
        <p className="share-tour-note">
          Clipboard text stays on your device until you tap Submit result.
        </p>
        <button ref={doneButton} type="button" onClick={onDone}>
          Got it — continue
        </button>
      </section>
    </div>
  );
}
