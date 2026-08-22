import GithubSlugger from "github-slugger";
import { RESERVED_SEGMENTS } from "./routing.ts";

export function slugify(title: string): string {
  const slugger = new GithubSlugger();
  // github-slugger maps every space to a dash, so "  a  b  " would become
  // "--a--b--". Normalise whitespace before handing it over.
  return slugger.slug(title.trim().replace(/\s+/g, " ")) || "post";
}

/**
 * Appends -2, -3 … until `taken` says the slug is free. A slug that collides
 * with a reserved path segment is nudged aside first, or the post would be
 * unreachable on the blog host.
 */
export function uniqueSlug(base: string, taken: (slug: string) => boolean): string {
  let candidate = RESERVED_SEGMENTS.has(base) ? `${base}-post` : base;
  let suffix = 2;
  while (taken(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
