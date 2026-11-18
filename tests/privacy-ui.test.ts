import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrivacyPage } from "../src/components/PrivacyPage";
import {
  shellForPath,
  stackBackPath,
  stackTitle,
} from "../src/components/ArcadeShell";

describe("Phase 14 privacy disclosure", () => {
  it("is accessible without authentication or account data", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    expect(html).toContain("Privacy and data handling");
    expect(html).toContain("What other players can see");
    expect(html).toContain("Sign-in and connected sites");
    expect(html).toContain("Result submissions");
    expect(html).toContain("Your account controls");
    expect(html).toContain("maximum retention period of 90 days");
    expect(html).toContain('href="/account"');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("raw_share_text");
  });

  it("uses the approved accessible stack navigation", () => {
    expect(shellForPath("/privacy")).toBe("stack");
    expect(stackTitle("/privacy")).toBe("Privacy and data");
    expect(stackBackPath("/privacy")).toBe("/today");
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    expect((html.match(/<h1\b/g) ?? [])).toHaveLength(1);
    expect((html.match(/<h2\b/g) ?? [])).toHaveLength(5);
  });
});
