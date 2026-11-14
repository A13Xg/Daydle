import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { changePassword, validateDisplayName } from "../lib/auth-actions";

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
  const [password, setPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const passwordRecovery =
    new URLSearchParams(window.location.search).get("reset") === "1";

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

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || savingPassword) return;
    setSavingPassword(true);
    setMessage("");
    setError("");
    try {
      await changePassword(client, password);
      setPassword("");
      window.history.replaceState(null, "", "/account");
      setMessage("Your password has been updated.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update your password.",
      );
    } finally {
      setSavingPassword(false);
    }
  }

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
      <h1 id="account-heading">Your account</h1>
      <p>
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
              Complete your profile by choosing a display name. OAuth-only
              accounts do not require a password.
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
                disabled={savingProfile}
              />
            </div>
            <button type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
          </form>
          <div className="identity-code">
            <span>Friend code</span>
            <strong>{profileState.friendCode}</strong>
            <small>
              Shareable codes, QR links, and friend connections arrive in Phase
              9.
            </small>
          </div>
        </>
      )}

      {passwordRecovery && (
        <form onSubmit={(event) => void updatePassword(event)}>
          <h2>Set a new password</h2>
          <div className="field">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={savingPassword}
            />
          </div>
          <button type="submit" disabled={savingPassword}>
            {savingPassword ? "Updating…" : "Update password"}
          </button>
        </form>
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
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </section>
  );
}
