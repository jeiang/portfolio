import type { APIRoute } from "astro";
import { SESSION_COOKIE, destroySession } from "../../lib/auth.ts";

export const POST: APIRoute = (context) => {
  destroySession(context.cookies.get(SESSION_COOKIE)?.value);
  context.cookies.delete(SESSION_COOKIE, { path: "/" });
  return context.redirect("/admin/login", 303);
};
