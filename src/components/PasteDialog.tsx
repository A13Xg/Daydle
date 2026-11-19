import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SavedResult } from "../../shared/results";
import { parseShare } from "../../shared/parsers";
import {
  MAX_PASTE_CHARS,
  readClipboardByGesture,
  validateManualPaste,
} from "../lib/clipboard";
import { markPlayedFromSubmittedResult } from "../lib/today-api";
import {
  getResultDetail,
  submitShare,
  resultErrorText,
  type SubmissionFeedback,
} from "../lib/results-api";
import {
  gameDisplayName,
  parsedPreview,
  puzzleDisplayName,
  resultSummary,
} from "../lib/result-view";

interface PasteDialogProps {
  onClose: () => void;
  client?: SupabaseClient | null;
  userId?: string | null;
}

type ExistingResult =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; value: SavedResult };

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
  const [existing, setExisting] = useState<ExistingResult | null>(null);
  const [approvedReplace, setApprovedReplace] = useState(false);
  const [confirmedGame, setConfirmedGame] = useState("");
  const [detailRetry, setDetailRetry] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);

  const inputState = validateManualPaste(value);
  const previewDecision = useMemo(
    () => (inputState.status === "success" ? parseShare(value) : null),
    [value, inputState.status],
  );
  const preview =
    previewDecision?.status === "parsed"
      ? parsedPreview(previewDecision.result)
      : null;
  const canSubmit = Boolean(
    client && userId && inputState.status === "success" && !saving && !reading,
  );

  useEffect(() => {
    area.current?.focus();
  }, []);

  useEffect(() => {
    if (!client || !userId || feedback?.status !== "conflict" || !feedback.id) {
      setExisting(null);
      return;
    }
    const controller = new AbortController();
    setExisting({ status: "loading" });
    void getResultDetail(client, userId, feedback.id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setExisting({ status: "ready", value: result });
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setExisting({ status: "error", message: resultErrorText(cause) });
        }
      });
    return () => controller.abort();
  }, [client, userId, feedback, detailRetry]);

  function resetFeedback() {
    setFeedback(null);
    setApprovedReplace(false);
    setConfirmedGame("");
  }

  function closeIfIdle() {
    if (saving || reading) return;
    onClose();
  }

  async function readNow() {
    if (reading || saving) return;
    setReading(true);
    setNotice("");
    resetFeedback();
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
          "Clipboard access was denied or interrupted. Paste manually into the editor.",
        unavailable:
          "This browser does not provide clipboard reading. Paste manually into the editor.",
        "too-large":
          "Copied text exceeds 10,000 characters. Paste a single result within the limit.",
      };
      setNotice(messages[result.status]);
    }
    setReading(false);
    area.current?.focus();
  }

  async function playedFeedback(
    message: string,
    resultId?: string,
  ): Promise<string> {
    if (!client || !userId || !resultId) return message;
    try {
      // Use the server-confirmed canonical result, including confirmed-game
      // disambiguation, rather than trusting a local preview for an account write.
      const saved = await getResultDetail(client, userId, resultId);
      const marker = await markPlayedFromSubmittedResult(
        client,
        userId,
        saved.game_slug,
        saved.puzzle_date,
      );
      if (marker === "historical")
        return (
          message + " This older puzzle did not change today's played status."
        );
      window.dispatchEvent(new Event("daydle:played-updated"));
      return message + " Marked played today.";
    } catch {
      // A confirmed result may be saved even if its separate played-mark write fails.
      return message + " Played status could not be verified; check Today.";
    }
  }

  async function submit(replaceResultId?: string, confirmedGameSlug?: string) {
    if (!client || !userId || !canSubmit) return;
    if (
      replaceResultId &&
      (feedback?.status !== "conflict" ||
        feedback.id !== replaceResultId ||
        existing?.status !== "ready" ||
        existing.value.id !== replaceResultId ||
        !approvedReplace)
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
      setApprovedReplace(false);
      switch (decision.status) {
        case "saved":
          setValue("");
          setNotice(
            await playedFeedback("Result saved to your history.", decision.id),
          );
          break;
        case "duplicate":
          setValue("");
          setNotice(
            await playedFeedback(
              "This result is already in your history. No duplicate was created.",
              decision.id,
            ),
          );
          break;
        case "replaced":
          setValue("");
          setNotice(
            await playedFeedback(
              "Saved result replaced. The correction has been recorded.",
              decision.id,
            ),
          );
          break;
        case "conflict":
          setNotice(
            "A different result is already recorded for this puzzle. Review both results before replacing.",
          );
          break;
        case "replace_target_mismatch":
          setNotice(
            "The saved result changed. Refresh History before submitting again.",
          );
          break;
        case "ambiguous":
          setNotice(
            "Share retained privately for parser analysis. It matches multiple games; choose the correct game below to save a result.",
          );
          break;
        case "unknown":
          setNotice(
            decision.captured
              ? "Unrecognized share stored privately for parser analysis. It is not a saved result."
              : "The share could not be retained. Check the input and try again.",
          );
          break;
        case "invalid":
          setNotice(
            "Share validation failed (" +
              decision.code +
              "). " +
              (decision.captured
                ? "A private sample was retained for parser review."
                : "No sample was retained because the input was empty, oversized or unsafe."),
          );
          break;
        default:
          setNotice(
            "Refresh History to confirm whether the last operation succeeded.",
          );
      }
    } catch (cause) {
      setFeedback(null);
      setNotice(resultErrorText(cause));
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeIfIdle();
    }
    if (event.key !== "Tab") return;
    const focusables = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
      ),
    ).filter((item) => item.getClientRects().length > 0);
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

  return (
    <div className="paste-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-busy={saving || reading}
        aria-labelledby="paste-title"
        className="panel paste-dialog"
        onKeyDown={onKeyDown}
      >
        <p className="eyebrow">ONE SHARE · ONE PUZZLE</p>
        <div className="paste-heading">
          <h2 id="paste-title">Paste Results</h2>
          <button
            type="button"
            onClick={closeIfIdle}
            disabled={saving || reading}
            aria-label="Close Paste Results"
          >
            Close
          </button>
        </div>
        <p>
          Copy one publisher share message and return here. Reading your
          clipboard requires a tap; manual paste always works. No text is
          uploaded until you select Submit result.
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
            rows={7}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              resetFeedback();
              setNotice("");
            }}
            maxLength={MAX_PASTE_CHARS + 1}
            placeholder="Paste the publisher's own share text here"
            autoComplete="off"
            spellCheck={false}
            disabled={saving || reading}
          />
        </div>
        <p className="muted paste-count">
          {value.length} / {MAX_PASTE_CHARS} characters
        </p>
        {inputState.status === "too-large" && (
          <p role="alert" className="notice error">
            One result must be 10,000 characters or fewer.
          </p>
        )}
        {preview && (
          <section
            className="paste-preview"
            aria-label="Local recognition preview"
          >
            <div className="paste-preview-head">
              <span className="eyebrow">RECOGNITION PREVIEW · LOCAL ONLY</span>
              <span className="history-outcome outcome-win">Detected</span>
            </div>
            <strong>{preview.game}</strong>
            <p>
              {preview.puzzle} · {preview.summary}
            </p>
            <small>
              Based only on the supplied share text. The server validates again
              on submission; gameplay cannot be verified.
            </small>
          </section>
        )}
        {previewDecision?.status === "unknown" && (
          <p className="muted paste-hint">
            This format is not recognized locally. Submitting will check the
            server and privately retain the sample for parser development.
          </p>
        )}
        {previewDecision?.status === "invalid" && (
          <p className="muted paste-hint">
            This share needs attention ({previewDecision.code}). Check the text
            before submitting.
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
            <p className="muted paste-submit-disclosure">
              Submit result uploads the pasted text for validation. If parsing
              fails, a private sample and failure category are retained with a
              90-day expiry date for parser improvement. Scheduled purge
              execution requires operational verification. Reading the clipboard
              alone does not upload text.
            </p>
          </div>
        )}
        {feedback?.status === "conflict" && feedback.id && (
          <section
            className="paste-conflict"
            aria-labelledby="paste-conflict-title"
          >
            <h3 id="paste-conflict-title">Existing result found</h3>
            {existing?.status === "loading" ? (
              <p role="status">Loading the saved result for comparison…</p>
            ) : existing?.status === "error" ? (
              <div role="alert">
                <p>
                  {existing.message} Replacement is unavailable until the saved
                  result can be reviewed.
                </p>
                <button
                  type="button"
                  onClick={() => setDetailRetry((n) => n + 1)}
                >
                  Retry comparison
                </button>
              </div>
            ) : existing?.status === "ready" &&
              existing.value.id === feedback.id ? (
              <>
                <div className="paste-conflict-grid">
                  <div className="paste-conflict-item">
                    <span className="eyebrow">ALREADY SAVED</span>
                    <strong>{existing.value.game_name}</strong>
                    <p>{puzzleDisplayName(existing.value.puzzle_key)}</p>
                    <p>{resultSummary(existing.value)}</p>
                  </div>
                  <div className="paste-conflict-item">
                    <span className="eyebrow">NEW SHARE</span>
                    <strong>
                      {preview?.game ??
                        gameDisplayName(existing.value.game_slug)}
                    </strong>
                    <p>
                      {preview?.puzzle ??
                        puzzleDisplayName(existing.value.puzzle_key)}
                    </p>
                    <p>{preview?.summary ?? "Re-evaluated on submission"}</p>
                  </div>
                </div>
                <label className="consent-line">
                  <input
                    type="checkbox"
                    checked={approvedReplace}
                    onChange={(event) =>
                      setApprovedReplace(event.target.checked)
                    }
                  />
                  I reviewed both results and want to replace the saved entry.
                </label>
                <button
                  className="paste-replace-action"
                  type="button"
                  disabled={!approvedReplace || !canSubmit}
                  onClick={() => void submit(feedback.id)}
                >
                  Confirm replacement
                </button>
              </>
            ) : null}
            <p className="muted">
              Opening History will discard the text in this dialog. Replacement
              is recorded as a correction.
            </p>
          </section>
        )}
        {feedback?.status === "ambiguous" && client && userId && (
          <section
            className="panel paste-unknown"
            aria-label="Confirm detected game"
          >
            <p>
              Confirm which game produced the share. The selected parser must
              still validate the text.
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
                    {gameDisplayName(slug)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!confirmedGame || !canSubmit}
              onClick={() => void submit(undefined, confirmedGame)}
            >
              Confirm game and submit
            </button>
          </section>
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
              resetFeedback();
              setNotice("");
              area.current?.focus();
            }}
            disabled={saving || reading}
          >
            Clear text
          </button>
          <button
            type="button"
            onClick={closeIfIdle}
            disabled={saving || reading}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
