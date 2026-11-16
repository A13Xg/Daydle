import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MAX_PASTE_CHARS,
  readClipboardByGesture,
  validateManualPaste,
} from "../lib/clipboard";
import {
  submitShare,
  retainUnknownShare,
  resultErrorText,
  type SubmissionFeedback,
} from "../lib/results-api";

interface PasteDialogProps {
  onClose: () => void;
  client?: SupabaseClient | null;
  userId?: string | null;
}

export function PasteDialog({
  onClose,
  client = null,
  userId = null,
}: PasteDialogProps) {
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<SubmissionFeedback | null>(null);
  const [retainConsent, setRetainConsent] = useState(false);
  const [sampleGame, setSampleGame] = useState("");
  const [confirmedGame, setConfirmedGame] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    area.current?.focus();
  }, []);

  async function readNow() {
    if (reading || saving) return;
    setReading(true);
    setNotice("");
    setFeedback(null);
    setRetainConsent(false);
    setConfirmedGame("");
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

  async function submit(replaceResultId?: string, confirmedGameSlug?: string) {
    if (
      !client ||
      !userId ||
      saving ||
      validateManualPaste(value).status !== "success"
    )
      return;
    setSaving(true);
    setNotice("");
    try {
      const decision = await submitShare(
        client,
        userId,
        value,
        replaceResultId,
        confirmedGameSlug,
      );
      setFeedback(decision);
      switch (decision.status) {
        case "saved":
          setValue("");
          setNotice("Saved one recognized puzzle result to your history.");
          break;
        case "duplicate":
          setValue("");
          setNotice(
            "That same result was already saved. No duplicate was created.",
          );
          break;
        case "replaced":
          setValue("");
          setNotice(
            "Your previous result was replaced; the correction was recorded.",
          );
          break;
        case "conflict":
          setNotice(
            "A different result is already saved for this puzzle. Check the existing result before choosing Replace.",
          );
          break;
        case "replace_target_mismatch":
          setNotice(
            "The saved result changed or was deleted. Review your history and try again.",
          );
          break;
        case "ambiguous":
          setNotice(
            "More than one supported game matches this share. Please paste a single complete publisher share result.",
          );
          break;
        case "unknown":
          setNotice(
            "This share format is not recognized. You may explicitly retain a sample for future parser support.",
          );
          break;
        case "invalid":
          setNotice(
            "The recognized result could not be validated (" +
              decision.code +
              "). Check that the share is complete.",
          );
          break;
        default:
          setNotice("Please review your history before submitting again.");
      }
    } catch (cause) {
      setFeedback(null);
      setNotice(resultErrorText(cause));
    } finally {
      setSaving(false);
    }
  }

  async function retainUnknown() {
    if (
      !client ||
      !userId ||
      saving ||
      !retainConsent ||
      feedback?.status !== "unknown"
    )
      return;
    setSaving(true);
    setNotice("");
    try {
      await retainUnknownShare(
        client,
        userId,
        value,
        sampleGame.trim() || undefined,
      );
      setValue("");
      setFeedback(null);
      setRetainConsent(false);
      setSampleGame("");
      setNotice(
        "Sample retained with a 90-day expiry date. Automated cleanup is not active yet. This is not a saved result.",
      );
    } catch (cause) {
      setNotice(resultErrorText(cause));
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
    if (event.key !== "Tab") return;
    const focusables = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
      ),
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first && last) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last && first) {
      event.preventDefault();
      first.focus();
    }
  }

  const state = validateManualPaste(value);
  const canSubmit = Boolean(
    client && userId && state.status === "success" && !saving && !reading,
  );
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
          Copy one game&apos;s share text from its publisher. Clipboard reading
          happens only when you tap the button below. You can always paste
          manually.
        </p>
        <button
          type="button"
          className="paste-cta"
          onClick={() => void readNow()}
          disabled={reading || saving}
        >
          {reading ? "Reading clipboard…" : "Paste from clipboard"}
        </button>
        <div className="field">
          <label htmlFor="paste-input">One game share result</label>
          <textarea
            id="paste-input"
            ref={area}
            rows={8}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setFeedback(null);
              setRetainConsent(false);
              setConfirmedGame("");
              setNotice("");
            }}
            maxLength={MAX_PASTE_CHARS + 1}
            placeholder="Paste the game's own share text here"
            autoComplete="off"
            spellCheck={false}
            disabled={saving}
          />
        </div>
        <p className="muted">
          {value.length} / {MAX_PASTE_CHARS} characters
        </p>
        {state.status === "too-large" && (
          <p role="alert" className="notice error">
            One result must be 10,000 characters or fewer.
          </p>
        )}
        {!client || !userId ? (
          <p className="notice" role="status">
            Text remains only in this editor and is not uploaded.{" "}
            <a href="/auth">Sign in</a> to save a recognized result.
          </p>
        ) : (
          <div className="paste-save-actions">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
            >
              {saving ? "Checking result…" : "Submit result"}
            </button>
            <a className="secondary-link" href="/history">
              View my history
            </a>
          </div>
        )}
        {feedback?.status === "conflict" && feedback.id && (
          <div
            className="notice"
            role="group"
            aria-label="Conflicting saved result"
          >
            <p>
              Replacing a result overwrites its current metrics and records a
              correction. Review the existing entry first.
            </p>
            <a href="/history">Review history</a>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submit(feedback.id)}
            >
              Replace existing result
            </button>
          </div>
        )}
        {feedback?.status === "ambiguous" && client && userId && (
          <div className="panel paste-unknown">
            <p>
              Confirm which game produced this share. Daydle will parse it again
              on the server; manually entered scores are not accepted.
            </p>
            <div className="field">
              <label htmlFor="confirm-share-game">Detected game</label>
              <select
                id="confirm-share-game"
                value={confirmedGame}
                onChange={(event) => setConfirmedGame(event.target.value)}
              >
                <option value="">Choose a game</option>
                {feedback.gameSlugs.map((slug) => (
                  <option key={slug} value={slug}>
                    {slug}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!confirmedGame || !canSubmit}
              onClick={() => void submit(undefined, confirmedGame)}
            >
              Confirm game and save
            </button>
          </div>
        )}
        {feedback?.status === "unknown" && client && userId && (
          <div className="panel paste-unknown">
            <p>
              Unrecognized shares are{" "}
              <strong>not retained automatically.</strong> Choose whether to
              send a sample for parser development. This does not count as a
              result.
            </p>
            <div className="field">
              <label htmlFor="unknown-game">Game slug (optional)</label>
              <input
                id="unknown-game"
                value={sampleGame}
                onChange={(event) => setSampleGame(event.target.value)}
                placeholder="e.g. worldle"
                autoComplete="off"
                maxLength={64}
              />
            </div>
            <label className="consent-line">
              <input
                type="checkbox"
                checked={retainConsent}
                onChange={(event) => setRetainConsent(event.target.checked)}
              />
              Assign a 90-day expiry to this sample for authorized review
              (automated deletion is not active yet)
            </label>
            <button
              type="button"
              disabled={!retainConsent || saving}
              onClick={() => void retainUnknown()}
            >
              Retain sample (not a saved result)
            </button>
          </div>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        <div className="paste-actions">
          <button
            type="button"
            onClick={() => {
              setValue("");
              setFeedback(null);
              setRetainConsent(false);
              setSampleGame("");
              setNotice("");
            }}
            disabled={saving}
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
