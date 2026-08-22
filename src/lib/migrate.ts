import type { DatabaseSync } from "node:sqlite";

/**
 * Applies any migrations the database has not seen, tracked by
 * `PRAGMA user_version`. An entry's index is its version, so the list is
 * append-only.
 *
 * Not a migration framework: the alternative to twenty lines here is
 * hand-editing production SQLite over SSH.
 */
export function migrate(handle: DatabaseSync, migrations: readonly string[]): number {
  const row = handle.prepare("PRAGMA user_version").get() as { user_version: number };
  let applied = 0;

  for (let version = row.user_version; version < migrations.length; version++) {
    handle.exec("BEGIN");
    try {
      handle.exec(migrations[version]!);
      // PRAGMA cannot be parameterised; the value is a loop index we own.
      handle.exec(`PRAGMA user_version = ${version + 1}`);
      handle.exec("COMMIT");
      applied += 1;
    } catch (error) {
      handle.exec("ROLLBACK");
      throw error;
    }
  }

  return applied;
}
