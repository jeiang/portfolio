import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getConfig } from "../lib/config.ts";
import { listPublished, summaryOf } from "../lib/posts.ts";

export const GET: APIRoute = () => {
  const { blogUrl } = getConfig();
  return rss({
    title: "Joshua Noel — Writing",
    description: "Notes on the things I build, and the problems that made me build them.",
    site: blogUrl,
    // Match the canonical spelling; the default appends a slash.
    trailingSlash: false,
    items: listPublished().map((post) => ({
      title: post.title,
      description: summaryOf(post),
      pubDate: new Date((post.published_at ?? post.updated_at) * 1000),
      link: `/${post.slug}`,
    })),
  });
};
