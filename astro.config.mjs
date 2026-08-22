// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  // Every route reads SQLite -- including the homepage, which lists recent
  // posts -- so nothing is prerendered and the build never touches a
  // database.
  output: "server",
  adapter: node({ mode: "standalone" }),
  // Both hostnames are served by this one process; canonical URLs are built
  // from PORTFOLIO_SITE_URL / PORTFOLIO_BLOG_URL at runtime instead.
  trailingSlash: "never",
  // No sharp (see pnpm.ignoredOptionalDependencies in package.json).
  // Nothing here uses astro:assets: uploads are resized in the browser.
  image: { service: { entrypoint: "astro/assets/services/noop" } },
  devToolbar: { enabled: false },
  vite: {
    // Inline every dependency into dist/server. Without this the runtime
    // closure keeps all of astro's build-time machinery -- rolldown alone
    // ships a ~18 MB binary per platform, and a deps FOD fetches every
    // platform. Bundling drops the shipped node_modules entirely.
    ssr: { noExternal: true },
  },
});
