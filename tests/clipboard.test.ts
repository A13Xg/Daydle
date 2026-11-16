import { describe, expect, it, vi } from "vitest";
import { MAX_PASTE_CHARS, readClipboardByGesture, validateManualPaste } from "../src/lib/clipboard";

describe("explicit clipboard interaction", () => {
  it("reads only when explicitly called, without eager side effects", async () => {
    const readText = vi.fn().mockResolvedValue("Wordle 1200 4/6");
    expect(readText).not.toHaveBeenCalled();
    await expect(readClipboardByGesture({ readText })).resolves.toEqual({
      status: "success", text: "Wordle 1200 4/6",
    });
    expect(readText).toHaveBeenCalledOnce();
  });

  it("reports denied/unsupported/empty without inventing a result", async () => {
    expect(await readClipboardByGesture(undefined)).toEqual({ status: "unavailable" });
    expect(await readClipboardByGesture({ readText: async () => "" }))
      .toEqual({ status: "empty" });
    expect(await readClipboardByGesture({ readText: async () => "   " }))
      .toEqual({ status: "empty" });
    expect(await readClipboardByGesture({ readText: async () => {
      throw new Error("NotAllowedError");
    } })).toEqual({ status: "denied" });
  });

  it("bounds both clipboard and manual input to one share message", async () => {
    const tooLong = "a".repeat(MAX_PASTE_CHARS + 1);
    expect(await readClipboardByGesture({ readText: async () => tooLong }))
      .toEqual({ status: "too-large" });
    expect(validateManualPaste(tooLong)).toEqual({ status: "too-large" });
    expect(validateManualPaste("")).toEqual({ status: "empty" });
  });
});
