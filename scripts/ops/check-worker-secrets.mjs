/** Validate required secret names without printing values or all bindings. */
export function hasRequiredWorkerSecrets(raw) {
  let items;
  try {
    items = JSON.parse(raw);
  } catch {
    return false;
  }
  return (
    Array.isArray(items) &&
    items.some((item) =>
      item &&
      item.name === "SUPABASE_SERVICE_ROLE_KEY" &&
      item.type === "secret_text"
    )
  );
}

if (process.argv[1]?.endsWith("check-worker-secrets.mjs")) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  if (!hasRequiredWorkerSecrets(Buffer.concat(chunks).toString("utf8"))) {
    console.error("Required Cloudflare secret SUPABASE_SERVICE_ROLE_KEY is missing or secret listing failed. No Worker deploy attempted.");
    process.exitCode = 1;
  } else {
    console.log("Verified Cloudflare Worker service-role secret binding is configured.");
  }
}
