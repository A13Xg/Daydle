// Dependency-free reproducible PNG icons, generated BEFORE Vite copies public/.
// Images are deterministic, non-networked and contain no personal information.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = join(process.cwd(), "public", "icons");
mkdirSync(out, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let step = 0; step < 8; step += 1) {
    crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length, 0);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([size, name, data, sum]);
}

function png(size) {
  const stride = size * 4 + 1;
  const pixels = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * stride;
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size, v = (y + 0.5) / size;
      const outer = ((u - 0.47) / 0.295) ** 2 +
        ((v - 0.50) / 0.26) ** 2 <= 1;
      const inner = ((u - 0.47) / 0.175) ** 2 +
        ((v - 0.50) / 0.155) ** 2 <= 1;
      const leftStem = u >= 0.285 && u < 0.415 && v >= 0.24 && v <= 0.76;
      const glyph = (outer && !inner && u >= 0.36) || leftStem;
      const accent = ((u - 0.775) / 0.041) ** 2 +
        ((v - 0.25) / 0.041) ** 2 <= 1;
      const rgb = accent ? [82, 216, 201] :
        glyph ? [255, 255, 255] : [24, 34, 50];
      const i = row + 1 + x * 4;
      pixels[i] = rgb[0];
      pixels[i + 1] = rgb[1];
      pixels[i + 2] = rgb[2];
      pixels[i + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["icon-maskable-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  writeFileSync(join(out, name), png(size));
}
console.log("Generated deterministic Daydle PWA icons (180, 192, 512 px).");
