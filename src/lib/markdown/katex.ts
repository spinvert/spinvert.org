import { fromHtml } from "hast-util-from-html";
import katex from "katex";
import { defineHastPlugin } from "satteri";

/**
 * Renders math parsed by Sätteri (`features.math`) with KaTeX at build time.
 *
 * Sätteri emits `$...$` as `<code class="math-inline">` and `$$...$$` as
 * `<pre><code class="math-display">`. Both are replaced by KaTeX output, which is converted
 * to HAST elements instead of raw HTML so it also compiles in MDX files.
 */
export const katexPlugin = defineHastPlugin({
  name: "katex",
  element: {
    filter: ["code"],
    visit(node, ctx) {
      const classes = node.properties?.className;
      const classList = Array.isArray(classes) ? classes : [];
      const display = classList.includes("math-display");
      if (!display && !classList.includes("math-inline")) return;

      const html = katex.renderToString(ctx.textContent(node), {
        displayMode: display,
        throwOnError: false,
      });
      ctx.replaceNode(
        display ? ctx.parent(node) : node,
        fromHtml(html, { fragment: true }).children,
      );
    },
  },
});
