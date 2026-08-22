import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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

export function verifyPassword(password: string, stored: string): boolean {
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

  const derived = scryptSync(password, Buffer.from(salt, "base64"), expectedBuf.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });

  return derived.length === expectedBuf.length && timingSafeEqual(derived, expectedBuf);
}

/** Constant-time compare for equal-length secrets; false on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
