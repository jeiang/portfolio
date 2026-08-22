import { defineMiddleware } from "astro:middleware";
import { SESSION_COOKIE, validateSession } from "./lib/auth.ts";
import { getConfig } from "./lib/config.ts";
import { resolveRoute } from "./lib/routing.ts";

/**
 * One process serves both hostnames. Routes live under src/pages/blog/, and
 * the blog host maps its root onto that subtree, so `blog.example.com/a-post`
 * renders `/blog/a-post` without the prefix ever appearing in a URL.
 *
 * The admin lives on the blog host alone. Serving it from both would mean two
 * session cookies on two origins and a login that appears to do nothing.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const config = getConfig();
  const { pathname, search } = context.url;
  const host = context.request.headers.get("host") ?? context.url.host;

  const action = resolveRoute({
    host,
    pathname,
    search,
    blogHost: config.blogHost,
    blogUrl: config.blogUrl,
  });

  // Canonicalisation runs first: an unauthenticated /admin on the apex must
  // land on the blog host's login form, not the apex's, or the session
  // cookie is set on an origin the admin never uses again.
  if (action.kind === "redirect") return context.redirect(action.location, 301);

  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isApi = pathname.startsWith("/api/");
  const isPublicEndpoint = pathname === "/admin/login" || pathname === "/api/login";

  if ((isAdmin || isApi) && !isPublicEndpoint) {
    if (!validateSession(context.cookies.get(SESSION_COOKIE)?.value)) {
      if (isApi) return new Response("Unauthorized", { status: 401 });
      return context.redirect(
        `/admin/login?next=${encodeURIComponent(pathname + search)}`,
        303,
      );
    }
  }

  // SameSite=Lax already withholds the cookie from cross-site POSTs; this
  // closes the gap for anything that reaches us with one anyway. Same-origin
  // forms and fetches always carry a matching Origin.
  if (
    (isAdmin || isApi) &&
    context.request.method !== "GET" &&
    context.request.method !== "HEAD"
  ) {
    const origin = context.request.headers.get("origin");
    if (origin !== config.siteUrl && origin !== config.blogUrl) {
      return new Response("Bad origin", { status: 403 });
    }
  }

  return action.kind === "rewrite" ? next(action.path) : next();
});
