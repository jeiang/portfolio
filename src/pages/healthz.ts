import type { APIRoute } from "astro";
import { getDb } from "../lib/db.ts";

export const GET: APIRoute = () => {
  // Touches the database so an unreadable state directory fails the check
  // rather than showing a healthy process that cannot serve anything.
  getDb().prepare("SELECT 1").get();
  return new Response("ok\n", { headers: { "content-type": "text/plain" } });
};
