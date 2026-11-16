import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ResultApiError,
  deleteResult,
  getResultDetail,
  loadResultHistory,
  resultErrorText,
  retainUnknownShare,
  submitShare,
} from "../src/lib/results-api";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function authenticatedClient(userId = USER): SupabaseClient {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: { access_token: "live.access.token", user: { id: userId } },
        },
        error: null,
      }),
    },
  } as unknown as SupabaseClient;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("browser-to-Worker owner results API", () => {
  it("refuses account mismatches before making any network request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      loadResultHistory(authenticatedClient(OTHER), USER),
    ).rejects.toMatchObject({
      code: "authentication_required",
      httpStatus: 401,
    });
    await expect(
      submitShare(authenticatedClient(OTHER), USER, "some result"),
    ).rejects.toMatchObject({
      code: "authentication_required",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends exactly one share with user token, no untrusted user id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ status: "saved", id: ID }, { status: 201 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = await submitShare(
      authenticatedClient(),
      USER,
      "Wordle share",
    );
    expect(result).toEqual({ status: "saved", id: ID });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/v1/results");
    expect(init.credentials).toBe("omit");
    expect(init.cache).toBe("no-store");
    expect(init.headers).toMatchObject({
      authorization: "Bearer live.access.token",
    });
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(payload).toEqual({ text: "Wordle share" });
    expect(payload).not.toHaveProperty("userId");
  });

  it("preserves explicit conflict, parser ambiguity and replacement semantics", async () => {
    const fake = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ status: "conflict", id: ID }, { status: 409 }),
      )
      .mockResolvedValueOnce(
        Response.json(
          { status: "ambiguous", gameSlugs: ["wordle", "quordle"] },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ status: "replaced", id: ID }));
    vi.stubGlobal("fetch", fake);
    expect(
      (await submitShare(authenticatedClient(), USER, "share")).status,
    ).toBe("conflict");
    expect(
      (await submitShare(authenticatedClient(), USER, "share")).status,
    ).toBe("ambiguous");
    expect(
      (await submitShare(authenticatedClient(), USER, "share", ID, "wordle"))
        .status,
    ).toBe("replaced");
    const body = JSON.parse(
      String((fake.mock.calls[2] as [string, RequestInit])[1].body),
    );
    expect(body).toEqual({
      text: "share",
      replaceResultId: ID,
      confirmedGameSlug: "wordle",
    });
  });

  it("only retains raw samples on an explicit user action", async () => {
    const fake = vi
      .fn()
      .mockResolvedValue(
        Response.json({ status: "retained", id: ID }, { status: 201 }),
      );
    vi.stubGlobal("fetch", fake);
    expect(
      (await retainUnknownShare(authenticatedClient(), USER, "unknown share"))
        .status,
    ).toBe("retained");
    const body = JSON.parse(
      String((fake.mock.calls[0] as [string, RequestInit])[1].body),
    );
    expect(body).toEqual({ text: "unknown share", retain: true });
  });

  it("validates detail and pagination, and sends owner-scoped delete", async () => {
    const value = {
      id: ID,
      game_slug: "wordle",
      game_name: "Wordle",
      puzzle_key: "wordle-99",
    };
    const fake = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ items: [value] }))
      .mockResolvedValueOnce(Response.json(value))
      .mockResolvedValueOnce(Response.json({ status: "deleted", id: ID }));
    vi.stubGlobal("fetch", fake);
    expect(
      await loadResultHistory(authenticatedClient(), USER, {
        game: "wordle",
        offset: 0,
      }),
    ).toEqual([value]);
    expect(await getResultDetail(authenticatedClient(), USER, ID)).toEqual(
      value,
    );
    await expect(
      deleteResult(authenticatedClient(), USER, ID),
    ).resolves.toBeUndefined();
    expect((fake.mock.calls[2] as [string, RequestInit])[1].method).toBe(
      "DELETE",
    );
    expect(String((fake.mock.calls[0] as [string, RequestInit])[0])).toContain(
      "game=wordle",
    );
  });

  it("does not echo upstream errors or submitted raw text into UI", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("secret problem"));
    vi.stubGlobal("fetch", fake);
    let captured: unknown;
    try {
      await submitShare(
        authenticatedClient(),
        USER,
        "very private clipboard text",
      );
    } catch (cause) {
      captured = cause;
    }
    expect(captured).toBeInstanceOf(ResultApiError);
    expect(resultErrorText(captured)).not.toContain("secret");
    expect(resultErrorText(captured)).not.toContain("clipboard text");
    expect(resultErrorText(captured)).toContain("Check your connection");
  });
});
