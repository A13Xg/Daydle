import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GameRequestsPage } from "../src/components/GameRequestsPage";
import { AdminPage } from "../src/components/AdminPage";
import {
  shellForPath,
  stackBackPath,
  stackTitle,
} from "../src/components/ArcadeShell";

const fakeClient = {} as SupabaseClient;
const USER = "11111111-1111-4111-8111-111111111111";

describe("Phase 11 Obsidian Arcade routes", () => {
  it("keeps both administrative routes in a mobile-safe stack shell", () => {
    expect(shellForPath("/requests")).toBe("stack");
    expect(stackTitle("/requests")).toBe("Request a game");
    expect(stackBackPath("/requests")).toBe("/games");
    expect(shellForPath("/admin")).toBe("stack");
    expect(stackTitle("/admin")).toBe("Administration");
    expect(stackBackPath("/admin")).toBe("/account");
  });

  it("allows signed-out users to see request discovery without mutation controls", () => {
    const html = renderToStaticMarkup(
      createElement(GameRequestsPage, { client: null, userId: null }),
    );
    expect(html).toContain("Request a game");
    expect(html).toContain("Community requests");
    expect(html).toContain('href="/auth"');
    expect(html).not.toContain('id="suggestion-name"');
    expect(html).not.toContain("Unrecognized private share");
  });

  it("shows authenticated suggestion form with bounded accessible fields", () => {
    const html = renderToStaticMarkup(
      createElement(GameRequestsPage, { client: fakeClient, userId: USER }),
    );
    expect(html).toContain('id="suggestion-name"');
    expect(html).toContain('id="suggestion-url"');
    expect(html).toContain('id="suggestion-notes"');
    expect(html).toContain("Submit request");
    expect(html).toContain("Approval does not guarantee result parsing support");
  });

  it("rejects guest operator controls without leaking sample metadata", () => {
    const html = renderToStaticMarkup(
      createElement(AdminPage, { client: fakeClient, userId: null }),
    );
    expect(html).toContain("Administration");
    expect(html).toContain('href="/auth"');
    expect(html).not.toContain("Inspect raw sample");
    expect(html).not.toContain('id="admin-section"');
  });

  it("does not fabricate admin access while status is loading", () => {
    const html = renderToStaticMarkup(
      createElement(AdminPage, { client: fakeClient, userId: USER }),
    );
    expect(html).toContain("Loading overview");
    expect(html).not.toContain("Inspect raw sample");
    expect(html).not.toContain("Save game");
  });
});
