import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { validateDisplayName } from "../lib/auth-actions";
import { ArcadeIcon } from "./ArcadeIcon";
import { loadAdminView } from "../lib/administration-api";
import { exportMyData, savePrivacyArchive, privacyErrorText, permanentlyDeleteMyAccount, DELETE_ACCOUNT_PHRASE } from "../lib/privacy-api";
import { clearSelectedSnapshot } from "../lib/offline-snapshot";

interface Profile {
  display_name: string;
  onboarding_completed: boolean;
}

type ProfileState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; profile: Profile; friendCode: string };

interface AccountPageProps {
  client: SupabaseClient | null;
  user: User | null;
  loadingSession: boolean;
}

export function AccountPage({
  client,
  user,
  loadingSession,
}: AccountPageProps) {
  const [profileState, setProfileState] = useState<ProfileState>({
    status: "loading",
  });
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [adminAccess, setAdminAccess] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setAdminAccess(false);
    if (!client || !user) return;
    const abort = new AbortController();
    loadAdminView(client, user.id, "overview", 0, undefined, abort.signal)
      .then(() => {
        if (!abort.signal.aborted) setAdminAccess(true);
      })
      .catch(() => {
        if (!abort.signal.aborted) setAdminAccess(false);
      });
    return () => abort.abort();
  }, [client, user?.id]);

  useEffect(() => {
    if (!client || !user) return;
    let live = true;
    void Promise.all([
      client
        .from("profiles")
        .select("display_name,onboarding_completed")
        .eq("id", user.id)
        .single(),
      client
        .from("friend_codes")
        .select("code")
        .eq("user_id", user.id)
        .single(),
    ])
      .then(([profileResult, codeResult]) => {
        if (!live) return;
        if (
          profileResult.error ||
          codeResult.error ||
          !profileResult.data ||
          !codeResult.data
        ) {
          setProfileState({
            status: "error",
            message: "Your account profile could not be loaded. Please retry.",
          });
          return;
        }
        const profile = profileResult.data as Profile;
        setProfileState({
          status: "loaded",
          profile,
          friendCode: codeResult.data.code as string,
        });
        setDisplayName(profile.display_name);
      })
      .catch(() => {
        if (live)
          setProfileState({
            status: "error",
            message: "Your account profile could not be loaded. Please retry.",
          });
      });
    return () => {
      live = false;
    };
  }, [client, user?.id, reload]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !user || savingProfile) return;
    setSavingProfile(true);
    setMessage("");
    setError("");
    try {
      const name = validateDisplayName(displayName);
      const { data, error: saveError } = await client
        .from("profiles")
        .update({ display_name: name, onboarding_completed: true })
        .eq("id", user.id)
        .select("display_name,onboarding_completed")
        .single();
      if (saveError || !data)
        throw saveError ?? new Error("Profile was not updated.");
      setProfileState((state) =>
        state.status === "loaded"
          ? { ...state, profile: data as Profile }
          : state,
      );
      setMessage("Your profile has been updated.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save your profile.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function downloadAccountExport() {
    if (!client || !user || exporting) return;
    setExporting(true);
    setExportProgress("Preparing private account export…");
    setError("");
    setMessage("");
    try {
      const data = await exportMyData(client, user.id, (dataset, count) => {
        setExportProgress("Collecting " + dataset.replaceAll("_", " ") + ": " + count + " records");
      });
      savePrivacyArchive(data);
      setMessage("Your private export file was prepared. Check your browser's downloads.");
    } catch (cause) {
      setError(privacyErrorText(cause));
    } finally {
      setExporting(false);
      setExportProgress("");
    }
  }

  async function deleteAccount() {
    if (!client || !user || deleting || deletePhrase !== DELETE_ACCOUNT_PHRASE)
      return;
    if (!window.confirm("Permanently delete your Daydle account and all saved results? This cannot be undone.")) return;
    setDeleting(true);
    setError("");
    setMessage("");
    try {
      await permanentlyDeleteMyAccount(client, user.id, deletePhrase);
      try {
        clearSelectedSnapshot(window.localStorage, user.id);
      } catch {
        // Privacy preference cache may be inaccessible; it never contains
        // results, credentials or raw share text.
      }
      await client.auth.signOut({ scope: "local" }).catch(() => undefined);
      window.location.replace("/today");
    } catch (cause) {
      setError(privacyErrorText(cause));
      setDeleting(false);
    }
  }

  // Signs out of every device, which is Supabase's default (global) scope.
  async function signOut() {
    if (!client) return;
    setError("");
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
    } else {
      window.location.assign("/");
    }
  }

  if (!client) {
    return (
      <section className="panel">
        <h1>Account</h1>
        <p>Authentication is not configured yet.</p>
      </section>
    );
  }
  if (loadingSession) {
    return (
      <section className="panel">
        <h1>Account</h1>
        <p role="status">Restoring your session…</p>
      </section>
    );
  }
  if (!user) {
    return (
      <section className="panel">
        <h1>Account</h1>
        <p>Sign in to manage your account.</p>
        <a href="/auth">Sign in</a>
      </section>
    );
  }

  return (
    <section aria-labelledby="account-heading" className="panel account-panel">
      <div className="account-hero">
        <span className="account-avatar" aria-hidden="true">
          <ArcadeIcon name="account" size={34} />
        </span>
        <div>
          <p className="eyebrow">PLAYER PROFILE</p>
          <h1 id="account-heading">Your account</h1>
          <p className="muted">
            Manage your identity and daily arcade preferences.
          </p>
        </div>
      </div>
      <p className="muted">
        <strong>Email:</strong> {user.email ?? "Email unavailable"}
      </p>
      {profileState.status === "loading" ? (
        <p role="status">Loading your profile…</p>
      ) : profileState.status === "error" ? (
        <div role="alert" className="notice error">
          <p>{profileState.message}</p>
          <button
            type="button"
            onClick={() => {
              setProfileState({ status: "loading" });
              setReload((value) => value + 1);
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {!profileState.profile.onboarding_completed && (
            <p className="notice" role="status">
              Complete your profile by choosing a display name.
            </p>
          )}
          <form onSubmit={(event) => void saveProfile(event)}>
            <div className="field">
              <label htmlFor="profile-name">Display name</label>
              <input
                id="profile-name"
                autoComplete="nickname"
                maxLength={80}
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                aria-describedby="profile-name-hint"
                disabled={savingProfile}
              />
              <small id="profile-name-hint" className="muted">
                Your display name is public: anyone can see it, including people
                who are not signed in. Your email address is never shown. If
                your Apple or Google name was filled in for you, change it here
                if you would rather not use your real name.
              </small>
            </div>
            <button type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
          </form>
          <div className="identity-code">
            <span>Friend code</span>
            <strong>{profileState.friendCode}</strong>
            <small>
              Share your code or an invitation QR to connect instantly.
            </small>
            <a href="/friends">Share code and manage friends</a>
            <a href={`/players/${user.id}`}>View my public profile</a>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="game-actions">
        {adminAccess && (
          <a className="secondary-link" href="/admin">
            Administration
          </a>
        )}
        <a className="secondary-link" href="/history">
          My result history
        </a>
        <button
          type="button"
          disabled={exporting}
          onClick={() => void downloadAccountExport()}
          aria-describedby="account-export-privacy"
        >
          {exporting ? "Preparing export…" : "Export my account data"}
        </button>
        <small id="account-export-privacy" className="fine-print">
          The JSON file may include private past share text and result history.
          Keep the downloaded file private. An interrupted export never saves a partial file.
        </small>
        {exportProgress && <p role="status">{exportProgress}</p>}
        <div className="field">
          <label htmlFor="delete-account-confirmation">Permanently delete account</label>
          <small>
            This permanently removes your profile, saved results, social
            relationships and other account data. Export your data first.
            Sign in again before deleting if prompted.
          </small>
          <input
            id="delete-account-confirmation"
            autoComplete="off"
            value={deletePhrase}
            onChange={(event) => setDeletePhrase(event.target.value)}
            placeholder={DELETE_ACCOUNT_PHRASE}
            aria-describedby="delete-account-warning"
          />
          <small id="delete-account-warning">
            Type the exact phrase shown to enable deletion.
            Older encrypted backups require separate expiration and
            deletion-reconciliation safeguards.
          </small>
          <button
            type="button"
            disabled={deleting || exporting || deletePhrase !== DELETE_ACCOUNT_PHRASE}
            onClick={() => void deleteAccount()}
          >
            {deleting ? "Deleting account…" : "Permanently delete my account"}
          </button>
        </div>
        <a className="secondary-link" href="/how-it-works">
          How Daydle works
        </a>
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </section>
  );
}
