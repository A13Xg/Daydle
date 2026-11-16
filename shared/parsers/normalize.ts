import type { ParserErrorCode } from "./types";

export const MAX_SHARE_LENGTH = 10_000;
export const MAX_SHARE_LINES = 64;

export type NormalizationResult =
  | { status: "valid"; lines: readonly string[] }
  | { status: "invalid"; code: ParserErrorCode };

export function normalizeShare(input: unknown): NormalizationResult {
  if (typeof input !== "string" || input.trim().length === 0) {
    return { status: "invalid", code: "empty" };
  }
  if (input.length > MAX_SHARE_LENGTH) {
    return { status: "invalid", code: "too_long" };
  }
  // Permit tab/newline/CR only; reject invisible controls that can disguise headers.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(input)) {
    return { status: "invalid", code: "control_character" };
  }
  const text = input
    .replace(/^\uFEFF/u, "")
    .replace(/\r\n?/gu, "\n")
    .replace(/\u00a0/gu, " ")
    .replace(/[\uFE0E\uFE0F]/gu, "")
    .normalize("NFC");
  const allLines = text.split("\n");
  if (allLines.length > MAX_SHARE_LINES) {
    return { status: "invalid", code: "too_many_lines" };
  }
  const lines = allLines.map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { status: "invalid", code: "empty" };
  return { status: "valid", lines };
}
