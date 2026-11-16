export type ClipboardOutcome =
  | { status: "success"; text: string }
  | { status: "empty" | "denied" | "unavailable" | "too-large" };

export const MAX_PASTE_CHARS = 10_000;

/** Must be called directly from a click/tap handler, not effects or focus. */
export async function readClipboardByGesture(
  clipboard: Pick<Clipboard, "readText"> | undefined,
): Promise<ClipboardOutcome> {
  if (!clipboard?.readText) return { status: "unavailable" };
  try {
    const text = await clipboard.readText();
    if (!text.trim()) return { status: "empty" };
    if (text.length > MAX_PASTE_CHARS) return { status: "too-large" };
    return { status: "success", text };
  } catch {
    return { status: "denied" };
  }
}

export function validateManualPaste(value: string): ClipboardOutcome {
  if (!value.trim()) return { status: "empty" };
  if (value.length > MAX_PASTE_CHARS) return { status: "too-large" };
  return { status: "success", text: value };
}
