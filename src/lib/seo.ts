// Structured data (JSON-LD, https://schema.org) describing the site and its pages for search
// engines and AI systems.

import { site } from "$lib/site";

export type JsonLd = Record<string, unknown>;

export interface Breadcrumb {
  name: string;
  /** Path relative to the site root, e.g. "/theory/" */
  path: string;
}

const organizationId = `${site.organization.url}/#organization`;

function websiteId(siteUrl: URL): string {
  return new URL("/#website", siteUrl).href;
}

/** Organization and website, used on the front page */
export function websiteJsonLd(siteUrl: URL): JsonLd {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: site.organization.name,
        url: site.organization.url,
        sameAs: [site.repoUrl],
      },
      {
        "@type": "WebSite",
        "@id": websiteId(siteUrl),
        name: site.name,
        url: siteUrl.href,
        description: site.description,
        inLanguage: "en",
        publisher: { "@id": organizationId },
      },
    ],
  };
}

/** Technical documentation page with its breadcrumb trail */
export function articleJsonLd(options: {
  siteUrl: URL;
  url: URL;
  title: string;
  description?: string;
  breadcrumbs: Breadcrumb[];
}): JsonLd {
  const { siteUrl, url, title, description, breadcrumbs } = options;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: title,
        description,
        url: url.href,
        inLanguage: "en",
        image: new URL(site.image.src, siteUrl).href,
        isPartOf: { "@type": "WebSite", "@id": websiteId(siteUrl), name: site.name },
        publisher: {
          "@type": "Organization",
          "@id": organizationId,
          name: site.organization.name,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((crumb, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: crumb.name,
          item: new URL(crumb.path, siteUrl).href,
        })),
      },
    ],
  };
}
