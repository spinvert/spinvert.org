import type { APIRoute } from "astro";
import { llmsFullTxt } from "$lib/llms";

export const GET: APIRoute = async ({ site, url }) =>
  new Response(await llmsFullTxt(site ?? url), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
