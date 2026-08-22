import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, safeEqual, verifyPassword } from "../src/lib/password.ts";

test("verifies the password it hashed", () => {
  const stored = hashPassword("correct horse battery staple");
  assert.ok(verifyPassword("correct horse battery staple", stored));
});

test("rejects the wrong password", () => {
  const stored = hashPassword("hunter2");
  assert.equal(verifyPassword("hunter3", stored), false);
});

test("salts, so the same password hashes differently every time", () => {
  assert.notEqual(hashPassword("same"), hashPassword("same"));
});

test("rejects malformed stored values instead of throwing", () => {
  for (const stored of ["", "nonsense", "scrypt$1$1$1$only-five", "bcrypt$1$1$1$a$b"]) {
    assert.equal(verifyPassword("x", stored), false, stored);
  }
});

test("safeEqual is false for different lengths", () => {
  assert.ok(safeEqual("admin", "admin"));
  assert.equal(safeEqual("admin", "admins"), false);
  assert.equal(safeEqual("admin", "admix"), false);
});
