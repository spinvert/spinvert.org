import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const schema = z.object({
  title: z.string(),
  description: z.string().optional(),
  // Position in the sidebar, lowest first
  order: z.number(),
  // Sidebar heading for the pages below this index page (e.g. the product name)
  section: z.string().optional(),
});

// Product documentation, one folder per product (e.g. boost-4820)
const hardware = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/hardware" }),
  schema,
});

// Generic background, independent of a specific product
const theory = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/theory" }),
  schema,
});

export const collections = { hardware, theory };
