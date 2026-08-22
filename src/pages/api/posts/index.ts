import type { APIRoute } from "astro";
import { createDraft } from "../../../lib/posts.ts";

export const POST: APIRoute = (context) => {
  const post = createDraft();
  return context.redirect(`/admin/${post.id}`, 303);
};
