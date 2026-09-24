import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIp, resolveRoute } from "../src/lib/routing.ts";

const route = (host: string, pathname: string, search = "") =>
  resolveRoute({
    host,
    pathname,
    search,
    blogHost: "blog.example.com",
    blogUrl: "https://blog.example.com",
  });

test("apex serves its own pages", () => {
  assert.deepEqual(route("example.com", "/"), { kind: "pass" });
  assert.deepEqual(route("example.com", "/healthz"), { kind: "pass" });
});

test("apex hands blog and admin paths to the blog host", () => {
  assert.deepEqual(route("example.com", "/blog/a-post"), {
    kind: "redirect",
    location: "https://blog.example.com/a-post",
  });
  assert.deepEqual(route("example.com", "/blog"), {
    kind: "redirect",
    location: "https://blog.example.com/",
  });
  assert.deepEqual(route("example.com", "/admin/3"), {
    kind: "redirect",
    location: "https://blog.example.com/admin/3",
  });
});

test("blog host maps its root onto the /blog subtree", () => {
  assert.deepEqual(route("blog.example.com", "/"), { kind: "rewrite", path: "/blog" });
  assert.deepEqual(route("blog.example.com", "/a-post"), {
    kind: "rewrite",
    path: "/blog/a-post",
  });
});

test("the /blog prefix is never a reachable URL", () => {
  assert.deepEqual(route("blog.example.com", "/blog/a-post"), {
    kind: "redirect",
    location: "https://blog.example.com/a-post",
  });
});

test("reserved segments are served, not treated as slugs", () => {
  for (const path of [
    "/admin",
    "/api/login",
    "/uploads/abc.webp",
    "/rss.xml",
    "/_astro/x.js",
  ]) {
    assert.deepEqual(route("blog.example.com", path), { kind: "pass" }, path);
  }
});

test("query strings survive both rewrites and redirects", () => {
  assert.deepEqual(route("blog.example.com", "/a-post", "?utm=1"), {
    kind: "rewrite",
    path: "/blog/a-post?utm=1",
  });
  assert.deepEqual(route("example.com", "/blog/a-post", "?utm=1"), {
    kind: "redirect",
    location: "https://blog.example.com/a-post?utm=1",
  });
});

test("client IP is the socket peer unless a loopback proxy forwarded it", () => {
  assert.equal(clientIp("198.51.100.7", "203.0.113.9"), "198.51.100.7");
  assert.equal(clientIp("198.51.100.7", null), "198.51.100.7");
  assert.equal(clientIp("127.0.0.1", "1.2.3.4, 203.0.113.9"), "203.0.113.9");
  assert.equal(clientIp("::1", "203.0.113.9"), "203.0.113.9");
  assert.equal(clientIp("::ffff:127.0.0.1", "203.0.113.9"), "203.0.113.9");
  assert.equal(clientIp("127.0.0.1", null), "127.0.0.1");
  assert.equal(clientIp("127.0.0.1", ""), "127.0.0.1");
});
