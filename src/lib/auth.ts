import { createHash, randomBytes } from "node:crypto";
import { getConfig } from "./config.ts";
import { getDb, now } from "./db.ts";
import { safeEqual, verifyPassword } from "./password.ts";

const SESSION_TTL_SECONDS = 14 * 24 * 60 * 60;

export const SESSION_COOKIE = "portfolio_session";

const tokenHash = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

/** Returns the opaque token; only its SHA-256 is ever stored. */
export function createSession(): { token: string; expiresAt: number } {
  const token = randomBytes(32).toString("base64url");
  const created = now();
  const expiresAt = created + SESSION_TTL_SECONDS;

  const db = getDb();
  db.prepare(
    "INSERT INTO sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)",
  ).run(tokenHash(token), created, expiresAt);
  // Opportunistic sweep: expiry is cheap to clean up where we already write.
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(created);

  return { token, expiresAt };
}

export function validateSession(token: string | undefined): boolean {
  if (!token) return false;
  const row = getDb()
    .prepare("SELECT 1 FROM sessions WHERE token_hash = ? AND expires_at > ?")
    .get(tokenHash(token), now());
  return row !== undefined;
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
}

const MAX_FAILURES = 5;
const LOCKOUT_SECONDS = 15 * 60;
// Enough for every address that plausibly fails in one lockout window;
// beyond it the oldest entry goes, so rotating addresses cannot grow memory.
const MAX_TRACKED = 10_000;

// ponytail: in-process Map, so a restart forgives everyone. Correct for one
// admin in one process; move it beside the sessions table if this ever runs
// more than one replica.
const failures = new Map<string, { count: number; until: number }>();

export function isLockedOut(ip: string): boolean {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (entry.until <= now()) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordFailure(ip: string): void {
  const entry = failures.get(ip) ?? { count: 0, until: 0 };
  entry.count += 1;
  entry.until = now() + LOCKOUT_SECONDS;
  // Re-insert so Map order stays oldest-failure-first for eviction.
  failures.delete(ip);
  if (failures.size >= MAX_TRACKED) {
    failures.delete(failures.keys().next().value!);
  }
  failures.set(ip, entry);
}

export function clearFailures(ip: string): void {
  failures.delete(ip);
}

export async function checkCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const config = getConfig();
  const userMatch = safeEqual(username, config.adminUsername);
  // Run the KDF regardless, so a wrong username is not measurably faster
  // than a wrong password.
  const passMatch = await verifyPassword(password, config.adminPasswordHash);
  return userMatch && passMatch;
}
