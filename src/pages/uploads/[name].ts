import type { APIRoute } from "astro";
import { readUpload } from "../../lib/uploads.ts";

// Served by the app rather than an nginx/Caddy alias so the container image
// and the NixOS module share one code path.
export const GET: APIRoute = ({ params }) => {
  const file = params.name ? readUpload(params.name) : undefined;
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.mime,
      // Names are content hashes: the bytes behind a URL never change.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};
