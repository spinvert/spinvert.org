export const site = {
  name: "Spinvert",
  /** Title of the front page in search results and link previews */
  title: "Spinvert · Open-source boost converter for small wind turbines",
  description:
    "Spinvert is an open-source hardware boost converter with active rectification for small wind turbines, micro-hydro and pedal generators.",
  repoUrl: "https://github.com/spinvert/",
  /** Default preview image for social media and chat apps (1200 × 630 px) */
  image: { src: "/og-image.jpg", alt: "Spinvert logo and the Spinvert Boost 4820 circuit board" },
  /** Operator of the website, see imprint */
  organization: {
    name: "Libre Solar Technologies GmbH",
    url: "https://libre.solar",
  },
};

/** Navigation item with either a link or nested items (shown as dropdown) */
export type NavItem = { label: string; href?: string; children?: NavItem[] };

export const navLinks: NavItem[] = [
  { label: "Overview", href: "/#top" },
  { label: "Hardware", href: "/hardware/boost-4820/" },
  { label: "Theory", href: "/theory/" },
];

export const legalLinks = [
  // The imprint holds the only copy of the full address and contact details
  { label: "Contact / Imprint", href: "/imprint/" },
  { label: "Privacy", href: "/privacy/" },
];
