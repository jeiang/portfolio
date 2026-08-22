import type { APIRoute } from "astro";
import { getConfig } from "../lib/config.ts";

export const GET: APIRoute = () => {
  const { blogUrl } = getConfig();
  return new Response(
    `User-agent: *\nDisallow: /admin\nDisallow: /api\n\nSitemap: ${blogUrl}/sitemap.xml\n`,
    { headers: { "content-type": "text/plain" } },
  );
};
