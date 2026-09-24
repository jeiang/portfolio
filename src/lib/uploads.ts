import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getConfig } from "./config.ts";

/** The admin re-encodes to WebP client-side; the rest are for direct drops. */
const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/avif": "avif",
};

const MIME_BY_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSIONS).map(([mime, extension]) => [extension, mime]),
);

const hasAt = (bytes: Uint8Array, offset: number, signature: string): boolean =>
  [...signature].every((char, i) => bytes[offset + i] === char.charCodeAt(0));

/** The bytes must be what the Content-Type claims; the name and served type follow it. */
const SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/webp": (bytes) => hasAt(bytes, 0, "RIFF") && hasAt(bytes, 8, "WEBP"),
  "image/jpeg": (bytes) => hasAt(bytes, 0, "\xff\xd8\xff"),
  "image/png": (bytes) => hasAt(bytes, 0, "\x89PNG"),
  "image/gif": (bytes) => hasAt(bytes, 0, "GIF8"),
  "image/avif": (bytes) =>
    hasAt(bytes, 4, "ftyp") && (hasAt(bytes, 8, "avif") || hasAt(bytes, 8, "avis")),
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Content-hashed names: free dedupe, immutable caching, no user input in a path. */
const NAME_PATTERN = /^[0-9a-f]{16}\.(webp|jpg|png|gif|avif)$/;

export function saveUpload(bytes: Uint8Array, mime: string): string {
  const extension = EXTENSIONS[mime];
  if (!extension) throw new Error(`unsupported image type: ${mime}`);
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new Error("file too large");
  if (!SIGNATURES[mime]!(bytes)) throw new Error(`file is not a valid ${mime}`);

  const { uploadsDir } = getConfig();
  mkdirSync(uploadsDir, { recursive: true });

  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const name = `${digest}.${extension}`;
  const path = join(uploadsDir, name);
  if (!existsSync(path)) writeFileSync(path, bytes);
  return name;
}

export function readUpload(name: string): { bytes: Buffer; mime: string } | undefined {
  const match = NAME_PATTERN.exec(name);
  if (!match) return undefined;

  const path = join(getConfig().uploadsDir, name);
  if (!existsSync(path)) return undefined;

  return { bytes: readFileSync(path), mime: MIME_BY_EXTENSION[match[1]!]! };
}

/** No media table: the directory listing is the index. */
export function listUploads(): string[] {
  const { uploadsDir } = getConfig();
  if (!existsSync(uploadsDir)) return [];
  return readdirSync(uploadsDir)
    .filter((name) => NAME_PATTERN.test(name))
    .sort();
}
