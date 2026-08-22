import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";

/**
 * remark, not `marked`, because Milkdown is remark: the editor and the
 * renderer parse with the same grammar, so what the WYSIWYG shows is what
 * publishes. A second parser here would disagree on tables and nested
 * lists, and the way you would find out is on the live site.
 *
 * Raw HTML is deliberately allowed. The only author is the authenticated
 * admin, so this is not a trust boundary -- it is an escape hatch for
 * embeds.
 */
/**
 * The page already renders the post title as <h1>. Without this, a writer
 * reaching for "Heading 1" in the editor — which is the obvious thing to
 * do — puts a second <h1> in every post.
 */
function demoteHeadings() {
  return (tree: unknown) => {
    visit(tree as never, "heading", (node: { depth: number }) => {
      node.depth = Math.min(node.depth + 1, 6);
    });
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(demoteHeadings)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeShiki, {
    // Emits --shiki-light/--shiki-dark CSS variables instead of baked
    // colours, so code blocks follow the site's prefers-color-scheme
    // block without a second stylesheet or a theme toggle.
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  })
  .use(rehypeStringify, { allowDangerousHtml: true });

export async function renderMarkdown(markdown: string): Promise<string> {
  return String(await processor.process(markdown));
}

/** Fallback for posts with no explicit excerpt. */
export function excerptFrom(markdown: string, limit = 160): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
