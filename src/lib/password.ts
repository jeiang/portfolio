import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";

// 128 * N * r = 16 MiB, comfortably under node's 32 MiB scrypt maxmem.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

/** `scrypt$N$r$p$salt$hash`. Parameters travel with the hash so they can change. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/** Promise form of crypto.scrypt; util.promisify drops the options overload's types. */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  const { promise, resolve, reject } = Promise.withResolvers<Buffer>();
  scrypt(password, salt, keylen, options, (error, derived) =>
    error ? reject(error) : resolve(derived),
  );
  return promise;
}

/** Async so a login attempt runs the KDF on the threadpool, not the event loop. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, salt, expected] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const expectedBuf = Buffer.from(expected, "base64");
  if (expectedBuf.length === 0) return false;

  const derived = await scryptAsync(
    password,
    Buffer.from(salt, "base64"),
    expectedBuf.length,
    { N: Number(n), r: Number(r), p: Number(p) },
  );

  return derived.length === expectedBuf.length && timingSafeEqual(derived, expectedBuf);
}

/** Constant-time compare for equal-length secrets; false on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
