import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HistoryPage } from "../src/components/HistoryPage";
import { PasteDialog } from "../src/components/PasteDialog";
import {
  ArcadeHeader,
  shellForPath,
  stackBackPath,
  stackTitle,
} from "../src/components/ArcadeShell";

const configured = { auth: {} } as unknown as SupabaseClient;

describe("Phase 7 owner results UI", () => {
  it("keeps History on a stack shell with a usable route out", () => {
    expect(shellForPath("/history")).toBe("stack");
    expect(stackTitle("/history")).toBe("Result history");
    expect(stackBackPath("/history")).toBe("/today");
    const header = renderToStaticMarkup(
      createElement(ArcadeHeader, {
        pathname: "/history",
        signedIn: true,
        onPaste: vi.fn(),
        pasteTrigger: { current: null },
      }),
    );
    expect(header).toContain("Result history");
    expect(header).toContain('href="/today"');
    expect(header).toContain("Paste Results");
  });

  it("does not show saved result data or invoke a network call for signed-out people", () => {
    const markup = renderToStaticMarkup(
      createElement(HistoryPage, {
        client: null,
        userId: null,
      }),
    );
    expect(markup).toContain("private until you sign in");
    expect(markup).toContain('href="/auth"');
    expect(markup).not.toContain("Saved results");
  });

  it("shows a truthful loading state and filter only for an authenticated session", () => {
    const markup = renderToStaticMarkup(
      createElement(HistoryPage, {
        client: configured,
        userId: "11111111-1111-4111-8111-111111111111",
      }),
    );
    expect(markup).toContain("Loading your result history");
    expect(markup).toContain('id="history-game"');
    expect(markup).not.toContain("14 Days");
    expect(markup).not.toContain("96%");
  });

  it("requires a session for result saves and keeps explicit clipboard permission", () => {
    const guest = renderToStaticMarkup(
      createElement(PasteDialog, {
        onClose: vi.fn(),
      }),
    );
    expect(guest).toContain("Paste from clipboard");
    expect(guest).toContain("not uploaded");
    expect(guest).not.toContain("Submit result");

    const signedIn = renderToStaticMarkup(
      createElement(PasteDialog, {
        onClose: vi.fn(),
        client: configured,
        userId: "11111111-1111-4111-8111-111111111111",
      }),
    );
    expect(signedIn).toContain("Submit result");
    expect(signedIn).toContain("View my history");
    expect(signedIn).toContain("disabled");
    expect(signedIn).not.toContain("Retain sample (not a saved result)");
  });
});
