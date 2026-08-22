import type { APIRoute } from "astro";
import {
  SESSION_COOKIE,
  checkCredentials,
  clearFailures,
  createSession,
  isLockedOut,
  recordFailure,
} from "../../lib/auth.ts";
import { clientIp } from "../../lib/routing.ts";

/** Only same-origin paths: a `next` of `//evil.example` is an open redirect. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/admin";
  return value;
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? ""));
  const ip = clientIp(context.request.headers.get("x-forwarded-for"));

  if (isLockedOut(ip)) return context.redirect("/admin/login?locked", 303);

  if (!checkCredentials(username, password)) {
    recordFailure(ip);
    return context.redirect(`/admin/login?failed&next=${encodeURIComponent(next)}`, 303);
  }

  clearFailures(ip);
  const { token, expiresAt } = createSession();

  context.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Behind a TLS-terminating proxy in production; plain http locally.
    secure: context.url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt * 1000),
  });

  return context.redirect(next, 303);
};
