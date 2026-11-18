/** Local, account-scoped first-use guidance. No profile or identity is uploaded. */
const KEY_PREFIX = "daydle:share-tutorial:v1:";

export function shouldShowShareTutorial(
  storage: Pick<Storage, "getItem"> | undefined,
  userId: string | null,
): boolean {
  if (!userId) return false;
  try {
    return storage?.getItem(KEY_PREFIX + userId) !== "seen";
  } catch {
    return true;
  }
}

export function markShareTutorialSeen(
  storage: Pick<Storage, "setItem"> | undefined,
  userId: string | null,
): void {
  if (!userId) return;
  try {
    storage?.setItem(KEY_PREFIX + userId, "seen");
  } catch {
    // Storage may be disabled; the current session still dismisses the tour.
  }
}
