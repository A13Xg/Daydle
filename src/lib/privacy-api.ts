import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PRIVACY_DATASETS, PRIVACY_EXPORT_PATH, projectPrivacyRows,
  type PrivacyDataset,
} from "../../shared/privacy";

export class PrivacyError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
export interface PrivacyArchive {
  format: "daydle-account-export";
  format_version: 1;
  exported_at: string;
  owner_id: string;
  owner_email: string | null;
  datasets: Record<PrivacyDataset, Record<string, unknown>[]>;
}

async function accessToken(
  client: SupabaseClient,
  userId: string,
): Promise<{ token: string; email: string | null }> {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session ||
      data.session.user.id.toLowerCase() !== userId.toLowerCase() ||
      !data.session.access_token) throw new PrivacyError("authentication_required");
  return { token: data.session.access_token, email: data.session.user.email ?? null };
}

/** Fetches every dataset to completion; never silently returns a truncated export. */
export async function exportMyData(
  client: SupabaseClient,
  userId: string,
  onProgress?: (dataset: PrivacyDataset, records: number) => void,
  signal?: AbortSignal,
): Promise<PrivacyArchive> {
  const datasets = {} as PrivacyArchive["datasets"];
  const original = await accessToken(client, userId);
  let byteEstimate = 0;
  for (const dataset of PRIVACY_DATASETS) {
    const items: Record<string, unknown>[] = [];
    const limit = dataset === "raw" ? 20 : 50;
    let cursor: string | null = null;
    while (true) {
      if (signal?.aborted) throw new PrivacyError("cancelled");
      const current = await accessToken(client, userId);
      if (current.email !== original.email)
        throw new PrivacyError("authentication_changed");
      const params = new URLSearchParams({ dataset, limit: String(limit) });
      if (cursor) params.set("cursor", cursor);
      let response: Response;
      try {
        response = await fetch(PRIVACY_EXPORT_PATH + "?" + params.toString(), {
          headers: { authorization: "Bearer " + current.token },
          cache: "no-store",
          credentials: "omit",
          signal,
        });
      } catch {
        throw new PrivacyError("connection_failed");
      }
      if (!response.ok) {
        if (response.status === 401) throw new PrivacyError("authentication_required");
        throw new PrivacyError("export_failed");
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new PrivacyError("invalid_response");
      }
      if (!body || typeof body !== "object" || Array.isArray(body) ||
          !("dataset" in body) || body.dataset !== dataset ||
          !("items" in body))
        throw new PrivacyError("invalid_response");
      const batch = projectPrivacyRows(dataset, body.items, cursor);
      if (!batch) throw new PrivacyError("invalid_response");
      byteEstimate += JSON.stringify(batch).length;
      if (byteEstimate > 60_000_000) throw new PrivacyError("export_too_large");
      items.push(...batch);
      onProgress?.(dataset, items.length);
      if (batch.length < limit) break;
      cursor = batch[batch.length - 1]?.id as string;
      if (items.length > 250_000) throw new PrivacyError("export_too_large");
    }
    datasets[dataset] = items;
  }
  // Confirm the current account still matches before handing out a complete file.
  const latest = await accessToken(client, userId);
  if (latest.email !== original.email)
    throw new PrivacyError("authentication_changed");
  return {
    format: "daydle-account-export",
    format_version: 1,
    exported_at: new Date().toISOString(),
    owner_id: userId,
    owner_email: original.email,
    datasets,
  };
}

export function privacyErrorText(error: unknown): string {
  const code = error instanceof PrivacyError ? error.code : "export_failed";
  switch (code) {
    case "authentication_required":
    case "authentication_changed":
      return "Your session changed. Sign in again before exporting.";
    case "export_too_large":
      return "This account contains too many records for an in-browser export. Contact support for a managed export.";
    case "cancelled":
      return "Export cancelled.";
    case "connection_failed":
      return "Connection interrupted. No incomplete export was saved; retry.";
    default:
      return "Data export could not be completed. No incomplete file was saved.";
  }
}

/** User-gesture flow; export never writes private data into app caches. */
export function savePrivacyArchive(archive: PrivacyArchive): void {
  const json = JSON.stringify(archive, null, 2);
  const file = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(file);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "daydle-account-export-" +
      new Date().toISOString().slice(0, 10) + ".json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Give Safari time to resolve the blob URL before revoking it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
