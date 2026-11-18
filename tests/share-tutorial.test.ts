import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareTutorial } from "../src/components/ShareTutorial";
import {
  markShareTutorialSeen,
  shouldShowShareTutorial,
} from "../src/lib/share-tutorial";

describe("first sign-in share walkthrough", () => {
  it("illustrates the actual publisher Share Results → Copy → Daydle Paste Results flow", () => {
    const html = renderToStaticMarkup(
      createElement(ShareTutorial, { onDone: () => undefined }),
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Share Results");
    expect(html).toContain("Choose Copy");
    expect(html).toContain("Paste Results");
    expect(html).toContain("Submit result");
    expect(html.match(/<button\b/g)).toHaveLength(1);
    expect(html).toContain("until you tap Submit result");
  });

  it("shows once per local account and never shares completion across accounts", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    expect(shouldShowShareTutorial(storage, "alice")).toBe(true);
    markShareTutorialSeen(storage, "alice");
    expect(shouldShowShareTutorial(storage, "alice")).toBe(false);
    expect(shouldShowShareTutorial(storage, "bob")).toBe(true);
    expect(shouldShowShareTutorial(storage, null)).toBe(false);
  });

  it("survives disabled local storage without breaking sign-in", () => {
    const blocked = {
      getItem: (): string | null => {
        throw new Error("blocked");
      },
      setItem: (): void => {
        throw new Error("blocked");
      },
    };
    expect(shouldShowShareTutorial(blocked, "alice")).toBe(true);
    expect(() => markShareTutorialSeen(blocked, "alice")).not.toThrow();
  });
});
