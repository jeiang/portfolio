import type { APIRoute } from "astro";
import { MAX_UPLOAD_BYTES, saveUpload } from "../../lib/uploads.ts";

// Raw body rather than multipart: the admin already re-encodes to a WebP
// blob client-side, so there is nothing else in the request to parse.
export const POST: APIRoute = async ({ request }) => {
  const mime = request.headers.get("content-type") ?? "";
  // Refuse a declared oversize before buffering it; the byte check below
  // still covers chunked bodies, which declare nothing.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) {
    return new Response("File too large", { status: 413 });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());

  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return new Response("File too large", { status: 413 });
  }

  try {
    return Response.json({ name: saveUpload(bytes, mime) });
  } catch (error) {
    return new Response((error as Error).message, { status: 400 });
  }
};
