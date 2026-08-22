import { test } from "node:test";
import assert from "node:assert/strict";
import { excerptFrom, renderMarkdown } from "../src/lib/markdown.ts";

test("renders GFM tables — the thing a WYSIWYG/renderer mismatch breaks first", async () => {
  const html = await renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |");
  assert.match(html, /<table>/);
  assert.match(html, /<td>1<\/td>/);
});

test("highlights code with both palettes as CSS variables", async () => {
  const html = await renderMarkdown("```js\nconst x = 1;\n```");
  assert.match(html, /class="shiki/);
  assert.match(html, /--shiki-light/);
  assert.match(html, /--shiki-dark/);
});

test("passes raw HTML through for embeds", async () => {
  const html = await renderMarkdown('<iframe src="https://example.com"></iframe>');
  assert.match(html, /<iframe/);
});

test("derives an excerpt from prose, not from markup", () => {
  assert.equal(
    excerptFrom("# Title\n\nSome **bold** text with a [link](https://example.com)."),
    "Title Some bold text with a link.",
  );
});

test("truncates on a word boundary", () => {
  const excerpt = excerptFrom("word ".repeat(80), 40);
  assert.ok(excerpt.length <= 41, excerpt);
  assert.ok(excerpt.endsWith("…"));
  assert.equal(excerpt.includes("wor…"), false);
});

test("skips fenced code and image syntax", () => {
  assert.equal(excerptFrom("```\nignored code\n```\n\nReal text."), "Real text.");
  assert.equal(
    excerptFrom("![alt](/uploads/a.webp)\n\nCaption follows."),
    "Caption follows.",
  );
});

test("demotes body headings so the post title keeps the only h1", async () => {
  const html = await renderMarkdown("# One\n\n## Two\n\n###### Six");
  assert.match(html, /<h2[^>]*>One<\/h2>/);
  assert.match(html, /<h3[^>]*>Two<\/h3>/);
  // Clamped, not wrapped around.
  assert.match(html, /<h6[^>]*>Six<\/h6>/);
  assert.equal(/<h1/.test(html), false);
});
