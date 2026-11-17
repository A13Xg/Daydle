import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PasteDialog } from "../src/components/PasteDialog";
import { TodayPage } from "../src/components/TodayPage";

describe("Paste and Today accessibility", () => {
  it("has a labeled manual fallback, explicit clipboard button and no unauthorized save action", () => {
    const markup = renderToStaticMarkup(
      createElement(PasteDialog, { onClose: vi.fn() }),
    );
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("Paste from clipboard");
    expect(markup).toContain("One game share result");
    expect(markup).toContain("not upload");
    expect(markup).toContain("Sign in");
    expect(markup).toContain('href="/auth"');
    expect(markup).not.toMatch(/<button[^>]*>Submit result<\/button>/);
  });

  it("never presents the signed-out visitor as a signed-in game player", () => {
    const markup = renderToStaticMarkup(
      createElement(TodayPage, { client: null, userId: null }),
    );
    expect(markup).toContain("Sign in with Apple or Google");
    expect(markup).toContain("/games");
  });

  it("shows no configured backend as an error rather than fake data", () => {
    const markup = renderToStaticMarkup(
      createElement(TodayPage, {
        client: null,
        userId: "owner",
      }),
    );
    expect(markup).toContain("not configured");
  });
});
