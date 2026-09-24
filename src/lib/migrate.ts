import type { DatabaseSync } from "node:sqlite";

/**
 * SQL for schema changes; a function for the rare data change SQL cannot
 * express, such as re-deriving a column with app code. Either runs inside
 * the version's transaction.
 */
export type Migration = string | ((handle: DatabaseSync) => void);

/**
 * Applies any migrations the database has not seen, tracked by
 * `PRAGMA user_version`. An entry's index is its version, so the list is
 * append-only.
 *
 * Not a migration framework: the alternative to twenty lines here is
 * hand-editing production SQLite over SSH.
 */
export function migrate(handle: DatabaseSync, migrations: readonly Migration[]): number {
  const row = handle.prepare("PRAGMA user_version").get() as { user_version: number };
  let applied = 0;

  for (let version = row.user_version; version < migrations.length; version++) {
    handle.exec("BEGIN");
    try {
      const migration = migrations[version]!;
      if (typeof migration === "string") handle.exec(migration);
      else migration(handle);
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
