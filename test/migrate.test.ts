import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "../src/lib/migrate.ts";

const init = readFileSync(
  new URL("../src/migrations/001_init.sql", import.meta.url),
  "utf8",
);

const version = (db: DatabaseSync): number =>
  (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;

test("applies pending migrations once", () => {
  const db = new DatabaseSync(":memory:");
  assert.equal(migrate(db, [init]), 1);
  assert.equal(version(db), 1);

  // Idempotent: a restart must not try to CREATE TABLE again.
  assert.equal(migrate(db, [init]), 0);
  assert.equal(version(db), 1);
});

test("the shipped schema is what the app expects", () => {
  const db = new DatabaseSync(":memory:");
  migrate(db, [init]);

  db.prepare(
    "INSERT INTO posts (slug, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
  ).run("hello", "Hello", 1, 1);

  const row = db.prepare("SELECT status, body_md FROM posts WHERE slug = ?").get("hello");
  assert.deepEqual({ ...row }, { status: "draft", body_md: "" });

  assert.throws(() =>
    db
      .prepare(
        "INSERT INTO posts (slug, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run("x", "X", "archived", 1, 1),
  );
});

test("a failed migration rolls back and leaves the version alone", () => {
  const db = new DatabaseSync(":memory:");
  migrate(db, [init]);

  assert.throws(() =>
    migrate(db, [init, "CREATE TABLE ok (a); SELECT nonsense_function();"]),
  );
  assert.equal(version(db), 1);
  assert.throws(() => db.prepare("SELECT 1 FROM ok").get());
});
