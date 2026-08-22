/**
 * Host-based routing, kept as a pure function so it can be tested without
 * booting Astro. src/middleware.ts is the thin adapter over it.
 */

/** First path segments the blog host serves itself instead of treating as a slug. */
export const RESERVED_SEGMENTS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "uploads",
  "healthz",
  "blog",
  "rss.xml",
  "sitemap.xml",
  "robots.txt",
  "favicon.ico",
  "_astro",
  "_image",
  "_server-islands",
  "_actions",
]);

export type RouteAction =
  | { kind: "pass" }
  | { kind: "rewrite"; path: string }
  | { kind: "redirect"; location: string };

export interface RouteInput {
  host: string;
  pathname: string;
  search: string;
  blogHost: string;
  blogUrl: string;
}

export function resolveRoute({
  host,
  pathname,
  search,
  blogHost,
  blogUrl,
}: RouteInput): RouteAction {
  const isBlogPath = pathname === "/blog" || pathname.startsWith("/blog/");

  // The /blog prefix is an implementation detail of the route tree. It is
  // never a reachable URL on either host, so a post has exactly one address.
  if (isBlogPath) {
    return {
      kind: "redirect",
      location: `${blogUrl}${pathname.slice(5) || "/"}${search}`,
    };
  }

  if (host !== blogHost) {
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return { kind: "redirect", location: `${blogUrl}${pathname}${search}` };
    }
    return { kind: "pass" };
  }

  const [, firstSegment = ""] = pathname.split("/");
  if (RESERVED_SEGMENTS.has(firstSegment)) return { kind: "pass" };

  return { kind: "rewrite", path: `/blog${pathname === "/" ? "" : pathname}${search}` };
}

/**
 * The last X-Forwarded-For entry, not the first: each proxy appends the peer
 * it received from, so the leftmost value is whatever the client chose to
 * send. No trust-proxy switch — this service is always behind one, and a
 * knob whose wrong setting silently disables throttling is worse than a
 * fixed assumption.
 */
export function clientIp(forwardedFor: string | null): string {
  if (!forwardedFor) return "direct";
  const hops = forwardedFor
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  return hops.at(-1) ?? "direct";
}
