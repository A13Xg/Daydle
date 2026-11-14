import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

export type AuthSessionState =
  | { status: "not-configured" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "signed-out" }
  | { status: "signed-in"; session: Session };

export function useAuthSession(client: SupabaseClient | null): AuthSessionState {
  const [state, setState] = useState<AuthSessionState>(
    client ? { status: "loading" } : { status: "not-configured" },
  );

  useEffect(() => {
    if (!client) {
      return;
    }

    let active = true;
    let receivedEvent = false;

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      receivedEvent = true;
      setState(session ? { status: "signed-in", session } : { status: "signed-out" });
    });

    void client.auth.getSession()
      .then(({ data, error }) => {
        if (!active || receivedEvent) return;
        if (error) {
          setState({ status: "error", message: "Could not restore your session." });
        } else {
          setState(data.session
            ? { status: "signed-in", session: data.session }
            : { status: "signed-out" });
        }
      })
      .catch(() => {
        if (active && !receivedEvent) {
          setState({ status: "error", message: "Could not restore your session." });
        }
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);

  return state;
}
