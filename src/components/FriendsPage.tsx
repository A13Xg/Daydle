import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  connectionLink,
  normalizeFriendCode,
  type SocialNetwork,
  type SocialAction,
  type SocialPerson,
} from "../../shared/social";
import {
  loadSocialNetwork,
  pendingFriendStorage,
  rememberPendingFriendCode,
  socialAction,
  socialErrorText,
} from "../lib/social-api";
import { ArcadeIcon } from "./ArcadeIcon";
import { FriendQr } from "./FriendQr";
import { FriendScanner } from "./FriendScanner";

type NetworkState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: SocialNetwork };
type Confirmation =
  | { action: "unfriend" | "block" | "unblock"; person: SocialPerson }
  | { action: "regenerate" };

function initialCode(): string {
  const url = new URLSearchParams(window.location.search);
  return normalizeFriendCode(url.get("code")) ?? "";
}

function actionText(status: string): string {
  switch (status) {
    case "connected":
      return "Friend added. Your friendship is mutual and active.";
    case "already_connected":
      return "You're already friends with that player.";
    case "regenerated":
      return "Friend code changed. Old invitation links no longer work.";
    case "blocked":
      return "Player blocked and removed from your friends.";
    case "unblocked":
      return "Player unblocked. You can reconnect by sharing a code.";
    case "unfriended":
      return "Friend removed from your list.";
    case "already_unfriended":
      return "That player is no longer in your friends.";
    default:
      return "Your friends list has been updated.";
  }
}

export function FriendsPage({
  client,
  userId,
}: {
  client: SupabaseClient | null;
  userId: string | null;
}) {
  const [state, setState] = useState<NetworkState>({ status: "loading" });
  const [code, setCode] = useState(initialCode);
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!client || !userId) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    void loadSocialNetwork(client, userId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: "ready", data });
      },
      (cause: unknown) => {
        if (!controller.signal.aborted)
          setState({ status: "error", message: socialErrorText(cause) });
      },
    );
    return () => controller.abort();
  }, [client, userId, refresh]);

  const detected = useCallback((found: string) => {
    setCode(found);
    setScannerOpen(false);
    setMessage("Code scanned. Select Connect to add this player.");
  }, []);

  async function submit(
    action: SocialAction,
    args: { code?: string; targetId?: string } = {},
  ) {
    if (!client || !userId || pending || !online) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await socialAction(client, userId, action, args);
      setMessage(actionText(result.status));
      if (action === "connect") {
        setCode("");
        if (window.history.replaceState)
          window.history.replaceState({}, "", "/friends");
      }
      setConfirm(null);
      setRefresh((n) => n + 1);
    } catch (cause) {
      setError(socialErrorText(cause));
    } finally {
      setPending(false);
    }
  }

  async function onConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valid = normalizeFriendCode(code);
    if (!valid) {
      setError("Enter a valid five-character code using the Daydle alphabet.");
      return;
    }
    await submit("connect", { code: valid });
  }

  const network = state.status === "ready" ? state.data : null;
  const link = network
    ? connectionLink(network.code, window.location.origin)
    : null;
  async function copyLink() {
    if (!link) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(link);
      setMessage("Invitation link copied.");
      setError("");
    } catch {
      setError(
        "Clipboard permission unavailable. Select and copy the invitation link below.",
      );
    }
  }
  async function shareLink() {
    if (!link) return;
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({ title: "Join me on Daydle", url: link });
      setMessage("Sharing options opened.");
      setError("");
    } catch {
      // A cancelled native share sheet is not an error.
    }
  }

  return (
    <section className="friends-page" aria-labelledby="friends-title">
      <header className="social-page-intro">
        <p className="eyebrow">SOCIAL ARCADE</p>
        <h1 id="friends-title">Friends & connections</h1>
        <p>
          Connect instantly with a five-character code. Friends are mutual — no
          request or approval step.
        </p>
      </header>
      {!online && (
        <p className="notice" role="status">
          You are offline. Your friend list and connections require a network
          connection.
        </p>
      )}
      {!client || !userId ? (
        <div className="panel social-guest">
          <span className="social-avatar" aria-hidden="true">
            <ArcadeIcon name="friends" size={32} />
          </span>
          <div>
            <h2>{code ? "Your invitation is ready" : "Play together"}</h2>
            <p>
              {code
                ? `Code ${code} is ready. Sign in with Apple or Google to connect.`
                : "Sign in to connect with friends, share your code and build your arcade circle."}
            </p>
            <a
              className="action-link"
              href="/auth"
              onClick={() => {
                if (code)
                  rememberPendingFriendCode(code, pendingFriendStorage());
              }}
            >
              Sign in to continue <ArcadeIcon name="arrow" size={18} />
            </a>
          </div>
        </div>
      ) : (
        <>
          {state.status === "loading" && (
            <div className="panel" role="status">
              Loading your connections…
            </div>
          )}
          {state.status === "error" && (
            <div className="notice error" role="alert">
              <p>{state.message}</p>
              <button
                type="button"
                disabled={!online}
                onClick={() => setRefresh((n) => n + 1)}
              >
                Retry
              </button>
            </div>
          )}
          {network && (
            <>
              <section
                className="social-grid"
                aria-label="Invitations and connections"
              >
                <div className="panel social-invite">
                  <div className="social-section-head">
                    <ArcadeIcon name="friends" size={23} />
                    <h2>Your invitation</h2>
                  </div>
                  <p className="muted">
                    Give a friend your personal code or send them the link.
                  </p>
                  <strong
                    className="social-code"
                    aria-label={`Friend code ${network.code.split("").join(" ")}`}
                  >
                    {network.code}
                  </strong>
                  {link && (
                    <div className="social-link-field">
                      <label htmlFor="share-friend-link">
                        Your invite link
                      </label>
                      <input
                        id="share-friend-link"
                        readOnly
                        value={link}
                        onFocus={(event) => event.target.select()}
                      />
                    </div>
                  )}
                  <div className="social-actions">
                    <button
                      type="button"
                      className="social-primary"
                      onClick={() => void copyLink()}
                      disabled={pending || !link}
                    >
                      <ArcadeIcon name="paste" size={18} /> Copy link
                    </button>
                    <button
                      type="button"
                      onClick={() => void shareLink()}
                      disabled={pending || !link}
                    >
                      Share
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrOpen((v) => !v)}
                      disabled={!link}
                      aria-expanded={qrOpen}
                    >
                      {qrOpen ? "Hide QR" : "Show QR"}
                    </button>
                  </div>
                  {qrOpen && link && (
                    <div className="social-qr-wrap">
                      <FriendQr url={link} />
                      <p className="muted">
                        Scan to open the code on another device. QR generation
                        stays on this device.
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    className="social-subtle"
                    onClick={() => setConfirm({ action: "regenerate" })}
                    disabled={pending}
                  >
                    Regenerate code
                  </button>
                  <a className="social-public-link" href={`/players/${userId}`}>
                    View your public profile
                  </a>
                </div>
                <div className="panel social-connect">
                  <div className="social-section-head">
                    <ArcadeIcon name="spark" size={23} />
                    <h2>Add a friend</h2>
                  </div>
                  <p className="muted">
                    Enter the code they shared. Both players appear in each
                    other's friends list immediately.
                  </p>
                  <form onSubmit={(event) => void onConnect(event)}>
                    <label htmlFor="friend-code-input">Friend code</label>
                    <input
                      id="friend-code-input"
                      value={code}
                      onChange={(event) =>
                        setCode(event.target.value.toUpperCase().slice(0, 5))
                      }
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      pattern="[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}"
                      maxLength={5}
                      placeholder="ABCDE"
                      required
                      disabled={pending || !online}
                    />
                    <button
                      type="submit"
                      className="social-primary"
                      disabled={
                        pending || !online || !normalizeFriendCode(code)
                      }
                    >
                      {pending ? "Connecting…" : "Connect now"}
                    </button>
                  </form>
                  <div className="social-scan-options">
                    <button
                      type="button"
                      disabled={pending || !online}
                      onClick={() => setScannerOpen((v) => !v)}
                      aria-expanded={scannerOpen}
                    >
                      {scannerOpen ? "Hide scanner" : "Scan an invite QR"}
                    </button>
                  </div>
                  {scannerOpen && (
                    <FriendScanner
                      onDetected={detected}
                      onClose={() => setScannerOpen(false)}
                    />
                  )}
                  <p className="muted social-disclaimer">
                    Codes are for discovery only. Sharing one never grants
                    account access or reveals hidden scores.
                  </p>
                </div>
              </section>

              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
              {message && (
                <p className="notice" role="status" aria-live="polite">
                  {message}
                </p>
              )}

              {confirm && (
                <div
                  className="panel social-confirm"
                  role="group"
                  aria-label="Confirm relationship change"
                >
                  <strong>
                    {confirm.action === "regenerate"
                      ? "Change your friend code?"
                      : `${confirm.action === "block" ? "Block" : confirm.action === "unfriend" ? "Remove" : "Unblock"} ${confirm.person.display_name}?`}
                  </strong>
                  <p className="muted">
                    {confirm.action === "regenerate"
                      ? "Your old invitations will stop working. Existing friendships are preserved."
                      : confirm.action === "block"
                        ? "You will no longer be friends. Either player can still see otherwise-public profiles."
                        : confirm.action === "unfriend"
                          ? "This immediately removes the mutual connection."
                          : "This permits a new connection by code; it won't restore your previous friendship."}
                  </p>
                  <div className="social-actions">
                    <button
                      type="button"
                      className={
                        confirm.action === "block"
                          ? "social-danger"
                          : "social-primary"
                      }
                      disabled={pending || !online}
                      onClick={() => {
                        if (confirm.action === "regenerate")
                          void submit("regenerate");
                        else
                          void submit(confirm.action, {
                            targetId: confirm.person.id,
                          });
                      }}
                    >
                      {pending ? "Saving…" : "Confirm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm(null)}
                      disabled={pending}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <section
                className="panel social-list-panel"
                aria-labelledby="social-friend-list-heading"
              >
                <div className="social-section-head">
                  <ArcadeIcon name="friends" size={23} />
                  <div>
                    <p className="eyebrow">YOUR CIRCLE</p>
                    <h2 id="social-friend-list-heading">Connected players</h2>
                  </div>
                  <span
                    className="social-count"
                    aria-label={`${network.friends.length} friends shown`}
                  >
                    {network.friends.length}
                    {network.has_more_friends ? "+" : ""}
                  </span>
                </div>
                {network.friends.length ? (
                  <ul className="social-friend-list">
                    {network.friends.map((person) => (
                      <li className="social-friend" key={person.id}>
                        <span
                          className="social-avatar social-avatar-small"
                          aria-hidden="true"
                        >
                          {person.display_name.trim().charAt(0).toUpperCase() ||
                            "P"}
                        </span>
                        <div className="social-friend-name">
                          <strong>{person.display_name}</strong>
                          <span>Connected player</span>
                        </div>
                        <div className="social-row-actions">
                          <a href={`/players/${person.id}`}>Profile</a>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              setConfirm({ action: "unfriend", person })
                            }
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              setConfirm({ action: "block", person })
                            }
                          >
                            Block
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="social-empty">
                    <ArcadeIcon name="friends" size={32} />
                    <h3>Your circle starts here</h3>
                    <p>
                      Share your invite code or enter a friend's code above to
                      connect.
                    </p>
                  </div>
                )}
                {network.has_more_friends && (
                  <p className="muted">
                    Showing your first 200 friends. Additional list pagination
                    is planned.
                  </p>
                )}
              </section>
              {network.blocked.length > 0 && (
                <section
                  className="panel social-list-panel"
                  aria-labelledby="blocked-heading"
                >
                  <h2 id="blocked-heading">Blocked players</h2>
                  <ul className="social-friend-list">
                    {network.blocked.map((person) => (
                      <li key={person.id} className="social-friend">
                        <span className="social-friend-name">
                          <strong>{person.display_name}</strong>
                        </span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            setConfirm({ action: "unblock", person })
                          }
                        >
                          Unblock
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section
                className="panel social-comparison"
                aria-labelledby="social-compare-heading"
              >
                <div className="social-section-head">
                  <ArcadeIcon name="statistics" size={23} />
                  <h2 id="social-compare-heading">Compare with friends</h2>
                </div>
                <p>
                  Your connections are ready. Head-to-head scores and
                  shared-game comparisons become available after spoiler-aware
                  ranking rules are verified.
                </p>
                <a className="secondary-link" href="/statistics">
                  View your own statistics
                </a>
              </section>
            </>
          )}
        </>
      )}
    </section>
  );
}
