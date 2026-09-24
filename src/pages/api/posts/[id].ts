import type { APIRoute } from "astro";
import { fromDatetimeLocal } from "../../../lib/format.ts";
import { deletePost, getById, savePost } from "../../../lib/posts.ts";

const parseId = (raw: string | undefined): number | undefined => {
  const id = Number(raw);
  return Number.isInteger(id) && getById(id) ? id : undefined;
};

export const PUT: APIRoute = async ({ params, request }) => {
  const id = parseId(params.id);
  if (id === undefined) return new Response("Not found", { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return new Response("Expected a JSON object", { status: 400 });
  }
  const status = body.status === "published" ? "published" : "draft";

  const post = await savePost(id, {
    title: String(body.title ?? ""),
    slug: String(body.slug ?? ""),
    body_md: String(body.body_md ?? ""),
    excerpt: body.excerpt ? String(body.excerpt) : null,
    cover_image: body.cover_image ? String(body.cover_image) : null,
    status,
    published_at: fromDatetimeLocal(String(body.published_at ?? "")),
  });

  return Response.json({
    slug: post.slug,
    status: post.status,
    published_at: post.published_at,
  });
};

export const DELETE: APIRoute = ({ params }) => {
  const id = parseId(params.id);
  if (id === undefined) return new Response("Not found", { status: 404 });
  deletePost(id);
  return new Response(null, { status: 204 });
};
