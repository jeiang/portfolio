import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getConfig } from "./config.ts";
import { migrate } from "./migrate.ts";
import init001 from "../migrations/001_init.sql?raw";
import summary002 from "../migrations/002_summary.sql?raw";

/**
 * Migrations are `.sql` files imported with Vite's `?raw` so they stay
 * diffable on disk but end up inside the server bundle. Resolving a data
 * directory relative to a bundled `entry.mjs` at runtime is the kind of path
 * problem that only shows up in production.
 *
 * Append only. An entry's index is its version.
 */
export const MIGRATIONS: readonly string[] = [init001, summary002];

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (db) return db;

  const { dbPath } = getConfig();
  mkdirSync(dirname(dbPath), { recursive: true });

  const handle = new DatabaseSync(dbPath);
  handle.exec("PRAGMA journal_mode = WAL");
  handle.exec("PRAGMA busy_timeout = 5000");
  handle.exec("PRAGMA foreign_keys = ON");
  migrate(handle, MIGRATIONS);

  // Sessions that outlived their expiry are dead weight from the last run.
  handle.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now());

  db = handle;
  return handle;
}

export function closeDb(): void {
  db?.close();
  db = undefined;
}

export const now = (): number => Math.floor(Date.now() / 1000);
