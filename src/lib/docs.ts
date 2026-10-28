import { type CollectionEntry, getCollection } from "astro:content";

export interface DocPage {
  href: string;
  title: string;
}

type DocsCollection = "hardware" | "theory";

/** URL of a documentation entry */
export function docHref(collection: DocsCollection, id: string): string {
  return id === "index" ? `/${collection}/` : `/${collection}/${id}/`;
}

/** Pages of a collection in sidebar order, optionally filtered */
export async function docPages(
  collection: DocsCollection,
  filter: (entry: CollectionEntry<DocsCollection>) => boolean = () => true,
): Promise<DocPage[]> {
  const entries = (await getCollection(collection)).filter(filter);
  return entries
    .sort((a, b) => a.data.order - b.data.order)
    .map((entry) => ({ href: docHref(collection, entry.id), title: entry.data.title }));
}
