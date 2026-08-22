import { getDb, now } from "./db.ts";
import { excerptFrom, renderMarkdown } from "./markdown.ts";
import { slugify, uniqueSlug } from "./slug.ts";

/** Everything a list view or a feed needs. Deliberately excludes the bodies. */
export interface PostSummary {
  id: number;
  slug: string;
  title: string;
  summary: string;
  cover_image: string | null;
  status: "draft" | "published";
  published_at: number | null;
  updated_at: number;
}

export interface Post extends PostSummary {
  body_md: string;
  body_html: string;
  excerpt: string | null;
  created_at: number;
}

// Listing a post costs a few hundred bytes; selecting * costs its entire
// rendered body, times however many posts are on the page.
const SUMMARY_COLUMNS =
  "id, slug, title, summary, cover_image, status, published_at, updated_at";

/**
 * Published *and* due: a published_at in the future keeps a post out of the
 * feed until the clock catches up, which is the whole of the scheduling
 * feature.
 */
const PUBLIC_WHERE =
  "status = 'published' AND published_at IS NOT NULL AND published_at <= ?";

export function listPublished(limit = 50): PostSummary[] {
  return getDb()
    .prepare(
      `SELECT ${SUMMARY_COLUMNS} FROM posts
        WHERE ${PUBLIC_WHERE}
        ORDER BY published_at DESC
        LIMIT ?`,
    )
    .all(now(), limit) as unknown as PostSummary[];
}

export function getPublishedBySlug(slug: string): Post | undefined {
  return getDb()
    .prepare(`SELECT * FROM posts WHERE slug = ? AND ${PUBLIC_WHERE}`)
    .get(slug, now()) as unknown as Post | undefined;
}

export function listAll(): PostSummary[] {
  return getDb()
    .prepare(
      `SELECT ${SUMMARY_COLUMNS} FROM posts
        ORDER BY COALESCE(published_at, updated_at) DESC`,
    )
    .all() as unknown as PostSummary[];
}

export function getById(id: number): Post | undefined {
  return getDb().prepare("SELECT * FROM posts WHERE id = ?").get(id) as unknown as
    Post | undefined;
}

export function slugTaken(slug: string, exceptId?: number): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM posts WHERE slug = ? AND id IS NOT ?")
    .get(slug, exceptId ?? null);
  return row !== undefined;
}

export function createDraft(): Post {
  const timestamp = now();
  const slug = uniqueSlug(`untitled-${timestamp}`, (candidate) => slugTaken(candidate));
  const result = getDb()
    .prepare(
      `INSERT INTO posts (slug, title, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(slug, "Untitled", timestamp, timestamp);
  return getById(Number(result.lastInsertRowid))!;
}

export interface PostInput {
  title: string;
  slug: string;
  body_md: string;
  excerpt: string | null;
  cover_image: string | null;
  status: "draft" | "published";
  published_at: number | null;
}

/** Markdown renders here, once per save, so a page view is a SELECT. */
export async function savePost(id: number, input: PostInput): Promise<Post> {
  const title = input.title.trim() || "Untitled";
  const requested = input.slug.trim() || slugify(title);
  const slug = uniqueSlug(requested, (candidate) => slugTaken(candidate, id));
  const html = await renderMarkdown(input.body_md);
  const excerpt = input.excerpt?.trim() || null;
  // Derived once here so no read path ever parses markdown.
  const summary = excerpt ?? excerptFrom(input.body_md);

  // Publishing stamps a time only if the author has not chosen one; a future
  // value is preserved so scheduling survives a re-save.
  const publishedAt =
    input.status === "published" ? (input.published_at ?? now()) : input.published_at;

  getDb()
    .prepare(
      `UPDATE posts
          SET slug = ?, title = ?, body_md = ?, body_html = ?, excerpt = ?,
              summary = ?, cover_image = ?, status = ?, published_at = ?,
              updated_at = ?
        WHERE id = ?`,
    )
    .run(
      slug,
      title,
      input.body_md,
      html,
      excerpt,
      summary,
      input.cover_image,
      input.status,
      publishedAt,
      now(),
      id,
    );

  return getById(id)!;
}

export function deletePost(id: number): void {
  getDb().prepare("DELETE FROM posts WHERE id = ?").run(id);
}

export const summaryOf = (post: PostSummary): string => post.summary;
