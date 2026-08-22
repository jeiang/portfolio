import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, uniqueSlug } from "../src/lib/slug.ts";

test("slugifies titles", () => {
  assert.equal(slugify("Hello, World!"), "hello-world");
  assert.equal(slugify("  Spaced   Out  "), "spaced-out");
});

test("never returns an empty slug", () => {
  assert.equal(slugify("!!!"), "post");
  assert.equal(slugify(""), "post");
});

test("suffixes on collision", () => {
  const taken = new Set(["hello", "hello-2"]);
  assert.equal(
    uniqueSlug("hello", (slug) => taken.has(slug)),
    "hello-3",
  );
});

test("moves a slug off a reserved path segment", () => {
  // A post at /admin would be shadowed by the admin route forever.
  assert.equal(
    uniqueSlug("admin", () => false),
    "admin-post",
  );
  assert.equal(
    uniqueSlug("rss.xml", () => false),
    "rss.xml-post",
  );
});
