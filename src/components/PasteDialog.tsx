import { useEffect, useRef, useState } from "react";
import {
  MAX_PASTE_CHARS,
  readClipboardByGesture,
  validateManualPaste,
} from "../lib/clipboard";

export function PasteDialog({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState("");
  const [reading, setReading] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    area.current?.focus();
  }, []);

  async function readNow() {
    if (reading) return;
    setReading(true);
    setNotice("");
    const result = await readClipboardByGesture(navigator.clipboard);
    if (result.status === "success") {
      setValue(result.text);
      setNotice(
        "Text copied into the editor. It has not been uploaded or saved.",
      );
    } else {
      const messages = {
        empty:
          "The clipboard is empty. Copy a game share message or paste manually.",
        denied:
          "Clipboard access was denied or interrupted. Press and hold the editor to paste manually.",
        unavailable:
          "This browser does not provide clipboard reading. Paste manually into the editor.",
        "too-large":
          "Copied text is over 10,000 characters. Paste one result no larger than the limit.",
      };
      setNotice(messages[result.status]);
    }
    setReading(false);
    area.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
    if (event.key !== "Tab") return;
    const focusables = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "button:not([disabled]),textarea:not([disabled])",
      ),
    );
    const first = focusables[0],
      last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first && last) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last && first) {
      event.preventDefault();
      first.focus();
    }
  }

  const state = validateManualPaste(value);
  return (
    <div className="paste-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paste-title"
        className="panel paste-dialog"
        onKeyDown={onKeyDown}
      >
        <p className="eyebrow">ONE SHARE · ONE PUZZLE</p>
        <div className="paste-heading">
          <h2 id="paste-title">Paste Results</h2>
          <button
            type="button"
            onClick={onClose}
            ref={closeButton}
            aria-label="Close Paste Results"
          >
            Close
          </button>
        </div>
        <p>
          Copy one game's share text from its publisher. Clipboard reading
          happens only when you tap the button below. You can always paste
          manually.
        </p>
        <button type="button" className="paste-cta" onClick={() => void readNow()} disabled={reading}>
          {reading ? "Reading clipboard…" : "Paste from clipboard"}
        </button>
        <div className="field">
          <label htmlFor="paste-input">One game share result</label>
          <textarea
            id="paste-input"
            ref={area}
            rows={8}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={MAX_PASTE_CHARS + 1}
            placeholder="Paste the game's own share text here"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <p className="muted">
          {value.length} / {MAX_PASTE_CHARS} characters
        </p>
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        {state.status === "too-large" && (
          <p role="alert" className="notice error">
            One result must be 10,000 characters or fewer.
          </p>
        )}
        <p className="notice">
          Result recognition and saving arrive in the next implementation
          phases. This preview keeps text only in memory and does not upload it.
        </p>
        <div className="paste-actions">
          <button
            type="button"
            onClick={() => {
              setValue("");
              setNotice("");
            }}
          >
            Clear text
          </button>
          <button type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
