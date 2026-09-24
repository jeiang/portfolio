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
    // block without a second stylesheet or a theme toggle. The -default
    // dark theme because plain github-dark greys comments out to 3:1.
    themes: { light: "github-light", dark: "github-dark-default" },
    defaultColor: false,
    // A fence with no language, or one shiki does not know, still goes
    // through shiki as plain text, so every code block gets the same
    // .shiki box instead of a bare <pre> the grid shows through.
    defaultLanguage: "text",
    fallbackLanguage: "text",
  })
  .use(rehypeStringify, { allowDangerousHtml: true });

export async function renderMarkdown(markdown: string): Promise<string> {
  return String(await processor.process(markdown));
}

// Parse only: the excerpt needs the tree, not HTML. GFM so a table is a
// table node rather than a paragraph full of pipes.
const excerptParser = unified().use(remarkParse).use(remarkGfm);

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
}

/** Only literal text: images and inline HTML contribute nothing a card can show. */
function textOf(node: MdNode): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? "";
  if (node.type === "break") return " ";
  return (node.children ?? []).map(textOf).join("");
}

/**
 * Fallback for posts with no explicit excerpt: the running prose, i.e. the
 * paragraphs at the top level and inside blockquotes. Headings, lists,
 * tables, code and raw HTML are structure, not a summary, and flattened
 * into one line they read as markup soup.
 */
export function excerptFrom(markdown: string, limit = 160): string {
  const paragraphs: string[] = [];
  let length = 0;

  const collect = (nodes: MdNode[]): void => {
    for (const node of nodes) {
      if (length > limit) return;
      if (node.type === "blockquote") collect(node.children ?? []);
      if (node.type !== "paragraph") continue;
      const text = textOf(node).replace(/\s+/g, " ").trim();
      if (!text) continue;
      paragraphs.push(text);
      length += text.length + 1;
    }
  };
  collect((excerptParser.parse(markdown) as MdNode).children ?? []);

  const text = paragraphs.join(" ");
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
