import {
  createCipheriv, createDecipheriv, randomBytes,
} from "node:crypto";
import { createReadStream } from "node:fs";
import {
  open, rename, unlink, stat,
} from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const MAGIC = Buffer.from("DAYDLEBK1", "ascii");
const NONCE_SIZE = 12;
const TAG_SIZE = 16;
const HEADER_SIZE = MAGIC.length + NONCE_SIZE;
const ALGORITHM = "aes-256-gcm";

function keyFromBase64(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    throw new Error("invalid_backup_key");
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value)
    throw new Error("invalid_backup_key");
  return key;
}

async function writeAll(handle, data) {
  let cursor = 0;
  while (cursor < data.length) {
    const { bytesWritten } = await handle.write(
      data, cursor, data.length - cursor,
    );
    if (bytesWritten <= 0) throw new Error("backup_io_failed");
    cursor += bytesWritten;
  }
}

function distinctFiles(input, output) {
  if (resolve(input) === resolve(output))
    throw new Error("backup_io_failed");
}

/**
 * A versioned, authenticated encrypted archive. Plaintext inputs must only
 * exist in the private ephemeral runner workspace; upload ONLY output.
 * The output path must not already exist (exclusive creation).
 */
export async function encryptBackup(input, output, base64Key) {
  distinctFiles(input, output);
  const key = keyFromBase64(base64Key);
  const nonce = randomBytes(NONCE_SIZE);
  const header = Buffer.concat([MAGIC, nonce]);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  cipher.setAAD(header);
  let handle;
  try {
    handle = await open(output, "wx", 0o600);
    await writeAll(handle, header);
    for await (const piece of createReadStream(input)) {
      await writeAll(handle, cipher.update(piece));
    }
    await writeAll(handle, cipher.final());
    await writeAll(handle, cipher.getAuthTag());
    await handle.sync();
    return true;
  } catch {
    if (handle) await handle.close().catch(() => undefined);
    await unlink(output).catch(() => undefined);
    throw new Error("backup_encryption_failed");
  } finally {
    if (handle) await handle.close().catch(() => undefined);
    key.fill(0);
  }
}

/**
 * Streams into a temporary path and only renames it after the GCM auth tag
 * verifies. A tampered archive is NEVER made available as a restore input.
 */
export async function decryptBackup(input, output, base64Key) {
  distinctFiles(input, output);
  const key = keyFromBase64(base64Key);
  const tmp = output + ".unverified-" + randomBytes(8).toString("hex");
  let source;
  let target;
  try {
    const size = (await stat(input)).size;
    if (size < HEADER_SIZE + TAG_SIZE)
      throw new Error("invalid_backup_archive");
    source = await open(input, "r");
    const header = Buffer.alloc(HEADER_SIZE);
    const tag = Buffer.alloc(TAG_SIZE);
    if ((await source.read(header, 0, HEADER_SIZE, 0)).bytesRead !== HEADER_SIZE ||
        (await source.read(tag, 0, TAG_SIZE, size-TAG_SIZE)).bytesRead !== TAG_SIZE ||
        !header.subarray(0, MAGIC.length).equals(MAGIC))
      throw new Error("invalid_backup_archive");
    const decipher = createDecipheriv(
      ALGORITHM, key, header.subarray(MAGIC.length),
    );
    decipher.setAAD(header);
    decipher.setAuthTag(tag);
    target = await open(tmp, "wx", 0o600);
    if (size > HEADER_SIZE + TAG_SIZE) {
      for await (const piece of createReadStream(input, {
        start: HEADER_SIZE, end: size-TAG_SIZE-1,
      })) {
        await writeAll(target, decipher.update(piece));
      }
    }
    await writeAll(target, decipher.final());
    await target.sync();
    await target.close();
    target = undefined;
    // Never overwrite a preexisting restore path. Reserved outputs must be
    // prepared by the protected backup runner before invoking this tool.
    try {
      const existing = await stat(output);
      if (existing) throw new Error("backup_output_exists");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await rename(tmp, output);
    return true;
  } catch {
    await unlink(tmp).catch(() => undefined);
    throw new Error("backup_decryption_failed");
  } finally {
    if (target) await target.close().catch(() => undefined);
    if (source) await source.close().catch(() => undefined);
    key.fill(0);
  }
}

const invoked = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (invoked === import.meta.url) {
  const [mode, input, output] = process.argv.slice(2);
  if (!input || !output || !["encrypt", "decrypt"].includes(mode)) {
    console.error("Usage: backup-crypto.mjs encrypt|decrypt INPUT OUTPUT");
    process.exitCode = 2;
  } else {
    try {
      const secret = process.env.DAYDLE_BACKUP_KEY_BASE64;
      if (mode === "encrypt")
        await encryptBackup(input, output, secret);
      else
        await decryptBackup(input, output, secret);
      console.log("Authenticated backup archive operation completed.");
    } catch {
      console.error("Backup archive operation failed; no verified output was produced.");
      process.exitCode = 1;
    }
  }
}
