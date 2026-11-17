// Content for /llms.txt and /llms-full.txt (https://llmstxt.org): a Markdown summary of the site
// with links to all documentation pages, so AI systems can find and understand the content.

import { type CollectionEntry, getCollection } from "astro:content";
import { docHref } from "$lib/docs";
import { site } from "$lib/site";

type DocsCollection = "hardware" | "theory";
type DocEntry = CollectionEntry<DocsCollection>;

const sections: { collection: DocsCollection; title: string }[] = [
  { collection: "hardware", title: "Hardware: Spinvert Boost 4820" },
  { collection: "theory", title: "Theory" },
];

async function sortedEntries(collection: DocsCollection): Promise<DocEntry[]> {
  return (await getCollection(collection)).sort((a, b) => a.data.order - b.data.order);
}

function pageUrl(collection: DocsCollection, entry: DocEntry, siteUrl: URL): string {
  return new URL(docHref(collection, entry.id), siteUrl).href;
}

function header(): string {
  return [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    "The hardware is in beta: the first prototypes of version v0.1 are currently being built and " +
      "tested. All design files are open source and available on GitHub.",
    "",
  ].join("\n");
}

/** Short index with one link per page */
export async function llmsTxt(siteUrl: URL): Promise<string> {
  const parts = [header()];
  for (const { collection, title } of sections) {
    parts.push(`## ${title}`, "");
    for (const entry of await sortedEntries(collection)) {
      const description = entry.data.description ? `: ${entry.data.description}` : "";
      parts.push(`- [${entry.data.title}](${pageUrl(collection, entry, siteUrl)})${description}`);
    }
    parts.push("");
  }
  parts.push(
    "## Optional",
    "",
    `- [Full documentation as a single file](${new URL("/llms-full.txt", siteUrl).href})`,
    `- [GitHub organization](${site.repoUrl}): hardware design files and source code`,
    `- [Contact / Imprint](${new URL("/imprint/", siteUrl).href})`,
    "",
  );
  return parts.join("\n");
}

/** Remove MDX syntax that is meaningless outside the website (imports, component tags) */
function plainMarkdown(body: string): string {
  return body
    .replace(/^import .*$/gm, "")
    .replace(/^\s*<[A-Z][\w.]*\b[^>]*\/>\s*$/gm, "") // self-closing components, e.g. calculators
    .replace(/^\s*<\/?[A-Z][\w.]*\b[^>]*>\s*$/gm, "") // opening/closing component tags, content stays
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** All documentation pages as Markdown in a single file */
export async function llmsFullTxt(siteUrl: URL): Promise<string> {
  const parts = [header()];
  for (const { collection, title } of sections) {
    parts.push(`## ${title}`, "");
    for (const entry of await sortedEntries(collection)) {
      parts.push(
        `### ${entry.data.title}`,
        "",
        `Source: ${pageUrl(collection, entry, siteUrl)}`,
        "",
        // Shift headings down by two levels to keep the document structure
        plainMarkdown(entry.body ?? "").replace(/^(#{1,4}) /gm, "$1## "),
        "",
      );
    }
  }
  return parts.join("\n");
}
