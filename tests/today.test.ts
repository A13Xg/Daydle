import { describe, expect, it } from "vitest";
import { isLocalDay, localDayString, manualPlayedLabel } from "../shared/today";

describe("Today's local calendar and played markers", () => {
  it("uses device-local calendar date rather than ISO UTC day", () => {
    const date = new Date(2026, 10, 15, 23, 59, 58);
    expect(localDayString(date)).toBe("2026-11-15");
    expect(isLocalDay("2026-11-15")).toBe(true);
  });

  it("rejects nonexistent and malformed local dates", () => {
    for (const invalid of [
      "2026-02-30",
      "2025-02-29",
      "2026-13-01",
      "2026-00-01",
      "2026-1-2",
      "1999-12-31",
      null,
      "2026-11-15T00:00:00Z",
    ]) {
      expect(isLocalDay(invalid)).toBe(false);
    }
    expect(isLocalDay("2028-02-29")).toBe(true);
  });

  it("labels played status without implying gameplay verification", () => {
    expect(manualPlayedLabel(true, true)).toBe("Played today");
    expect(manualPlayedLabel(false, true)).toBe("Not yet played");
    expect(manualPlayedLabel(false, false)).toContain("unavailable offline");
  });
});
