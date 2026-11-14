import { describe, expect, it } from "vitest";
import {
  FRIEND_CODE_ALPHABET,
  isFriendCode,
  resultIdentity,
} from "../shared/domain";

describe("domain invariants", () => {
  it("uses a distinct unambiguous 31-character code alphabet", () => {
    expect(FRIEND_CODE_ALPHABET.length).toBe(31);
    expect(new Set(FRIEND_CODE_ALPHABET).size).toBe(
      FRIEND_CODE_ALPHABET.length,
    );
    expect(FRIEND_CODE_ALPHABET).not.toMatch(/[ILO01]/);
    expect(FRIEND_CODE_ALPHABET.length ** 5).toBeGreaterThan(100_000);
  });

  it("accepts exactly five uppercase safe characters", () => {
    expect(isFriendCode("7KMP4")).toBe(true);
    expect(isFriendCode("2QRS9")).toBe(true);
    for (const input of [
      "0O1IL",
      "7kmp4",
      "ABC",
      "ABCDEFG",
      "ABC 2",
      "",
      null,
      123,
    ]) {
      expect(isFriendCode(input)).toBe(false);
    }
  });

  it("keys canonical results to user and puzzle, not puzzle date", () => {
    expect(resultIdentity("alice", "puzzle-100")).not.toBe(
      resultIdentity("bob", "puzzle-100"),
    );
    expect(resultIdentity("alice", "puzzle-100")).not.toBe(
      resultIdentity("alice", "puzzle-101"),
    );
  });
});
