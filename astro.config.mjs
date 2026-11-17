// @ts-check
import { defineConfig, fontProviders } from "astro/config";

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";

import { satteri } from "@astrojs/markdown-satteri";
import tailwindcss from "@tailwindcss/vite";
import { katexPlugin } from "./src/lib/markdown/katex.ts";

// https://astro.build/config
export default defineConfig({
  site: "https://spinvert.org",
  integrations: [svelte(), mdx(), sitemap()],
  build: {
    format: "directory",
  },
  trailingSlash: "always",
  markdown: {
    // LaTeX math with $...$ (inline) and $$...$$ (block), rendered to HTML at build time
    processor: satteri({ features: { math: true }, hastPlugins: [katexPlugin] }),
  },
  vite: {
    plugins: [tailwindcss()],
  },

  fonts: [
    {
      // Inter from the locally installed @fontsource-variable/inter package. Only the latin
      // subset is included, which covers English and German.
      provider: fontProviders.local(),
      name: "Inter",
      cssVariable: "--font-inter",
      display: "block", // hide text until the font is loaded instead of showing a fallback
      options: {
        variants: [
          {
            src: ["@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"],
            weight: "100 900",
            style: "normal",
            unicodeRange: [
              "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
            ],
          },
        ],
      },
    },
  ],
});
