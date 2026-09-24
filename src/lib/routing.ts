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

const isLoopback = (address: string): boolean =>
  address === "::1" || /^(::ffff:)?127\./.test(address);

/**
 * The address to throttle a login by. Normally the socket peer: headers are
 * the client's to choose, and the container image publishes the port with
 * no proxy in front. A loopback peer is the documented reverse proxy on the
 * same machine, and then the last X-Forwarded-For entry is the address it
 * saw — each proxy appends its peer, so the leftmost values are whatever the
 * client sent.
 */
export function clientIp(peer: string, forwardedFor: string | null): string {
  if (!isLoopback(peer)) return peer;
  const hops = (forwardedFor ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  return hops.at(-1) ?? peer;
}
