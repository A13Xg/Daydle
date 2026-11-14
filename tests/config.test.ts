import { describe, expect, it } from "vitest";
import { readPublicSupabaseConfig } from "../src/lib/config";

const publishableKey = "sb_publishable_example_value";

describe("public Supabase configuration", () => {
  it("supports startup without any Supabase project", () => {
    expect(readPublicSupabaseConfig({})).toEqual({ status: "unconfigured" });
  });

  it("accepts an HTTPS project and a public publishable key", () => {
    expect(
      readPublicSupabaseConfig({
        VITE_SUPABASE_URL: "https://daydle.supabase.co/rest/v1",
        VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      }),
    ).toEqual({
      status: "configured",
      url: "https://daydle.supabase.co",
      publishableKey,
    });
  });

  it("allows loopback HTTP for local Supabase development", () => {
    const result = readPublicSupabaseConfig({
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    });
    expect(result.status).toBe("configured");
  });

  it("rejects missing values, unsafe URLs, and privileged keys", () => {
    const cases = [
      { VITE_SUPABASE_URL: "https://daydle.supabase.co" },
      { VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey },
      {
        VITE_SUPABASE_URL: "not a URL",
        VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      },
      {
        VITE_SUPABASE_URL: "http://example.com",
        VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      },
      {
        VITE_SUPABASE_URL: "https://daydle.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_1234",
      },
    ];

    for (const input of cases) {
      expect(readPublicSupabaseConfig(input).status).toBe("invalid");
    }
  });
});
