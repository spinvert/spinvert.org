import type { APIRoute } from "astro";
import { llmsTxt } from "$lib/llms";

export const GET: APIRoute = async ({ site, url }) =>
  new Response(await llmsTxt(site ?? url), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
