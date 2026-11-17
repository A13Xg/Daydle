import { afterEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decryptBackup, encryptBackup } from "../scripts/ops/backup-crypto.mjs";

const dirs: string[] = [];
const key = randomBytes(32).toString("base64");
async function sandbox() {
  const dir = await mkdtemp(join(tmpdir(), "daydle-backup-test-"));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("Phase 12 authenticated backup encryption", () => {
  it("roundtrips large binary/custom-format data without plaintext inside ciphertext", async () => {
    const dir = await sandbox();
    const input = join(dir, "source.dump");
    const encrypted = join(dir, "archive.daydlebk");
    const restored = join(dir, "verified.dump");
    const bytes = Buffer.concat([
      Buffer.from("Private test database record with Unicode ñ 🌟\n"),
      randomBytes(300_000),
    ]);
    await writeFile(input, bytes);
    await encryptBackup(input, encrypted, key);
    await decryptBackup(encrypted, restored, key);
    expect(await readFile(restored)).toEqual(bytes);
    const blob = await readFile(encrypted);
    expect(blob.subarray(0, 9).toString()).toBe("DAYDLEBK1");
    expect(blob.includes(Buffer.from("Private test database record"))).toBe(
      false,
    );
  });

  it("never produces a restore file when the key is wrong", async () => {
    const dir = await sandbox();
    const input = join(dir, "source.dump");
    const encrypted = join(dir, "archive.daydlebk");
    const restored = join(dir, "restore.dump");
    await writeFile(input, "Confidential private fixture");
    await encryptBackup(input, encrypted, key);
    await expect(
      decryptBackup(encrypted, restored, randomBytes(32).toString("base64")),
    ).rejects.toThrow("backup_decryption_failed");
    expect((await readdir(dir)).sort()).toEqual([
      "archive.daydlebk",
      "source.dump",
    ]);
  });

  it("rejects one-byte ciphertext, nonce and authentication-tag tampering", async () => {
    const dir = await sandbox();
    const input = join(dir, "source.dump");
    const encrypted = join(dir, "archive.daydlebk");
    const original = Buffer.from(
      "Data that must not be restored after tampering.",
    );
    await writeFile(input, original);
    await encryptBackup(input, encrypted, key);
    const valid = await readFile(encrypted);
    for (const position of [4, 12, 23, valid.length - 1]) {
      const tampered = Buffer.from(valid);
      tampered[position] = (tampered[position] ?? 0) ^ 0x80;
      const name = join(dir, "tampered-" + position + ".daydlebk");
      await writeFile(name, tampered);
      await expect(
        decryptBackup(name, join(dir, "restore-" + position), key),
      ).rejects.toThrow("backup_decryption_failed");
      expect(
        (await readdir(dir)).some((f) => f.startsWith("restore-" + position)),
      ).toBe(false);
    }
  });

  it("refuses destination overwrite for both encryption and verified restore", async () => {
    const dir = await sandbox();
    const input = join(dir, "source.dump");
    const encrypted = join(dir, "archive.daydlebk");
    const existing = join(dir, "existing.txt");
    await writeFile(input, "Source bytes");
    await writeFile(existing, "Do not overwrite");
    await encryptBackup(input, encrypted, key);
    await expect(encryptBackup(input, existing, key)).rejects.toThrow(
      "backup_encryption_failed",
    );
    await expect(decryptBackup(encrypted, existing, key)).rejects.toThrow(
      "backup_decryption_failed",
    );
    expect(await readFile(existing, "utf8")).toBe("Do not overwrite");
  });

  it("never reuses the same nonce or accepts a noncanonical key", async () => {
    const dir = await sandbox();
    const input = join(dir, "source.dump");
    const one = join(dir, "one.daydlebk");
    const two = join(dir, "two.daydlebk");
    await writeFile(input, "Predictable plaintext");
    await encryptBackup(input, one, key);
    await encryptBackup(input, two, key);
    expect(await readFile(one)).not.toEqual(await readFile(two));
    await expect(
      encryptBackup(input, join(dir, "bad"), "fake-key"),
    ).rejects.toThrow("invalid_backup_key");
    await expect(encryptBackup(input, input, key)).rejects.toThrow(
      "backup_io_failed",
    );
  });
});
