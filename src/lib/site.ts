export const site = {
  name: "Spinvert",
  description:
    "Spinvert is an open-source hardware boost converter with active rectification for small wind turbines, micro-hydro and pedal generators.",
  repoUrl: "https://github.com/spinvert/",
};

/** Navigation item with either a link or nested items (shown as dropdown) */
export type NavItem = { label: string; href?: string; children?: NavItem[] };

export const navLinks: NavItem[] = [
  { label: "Overview", href: "/#top" },
  { label: "Hardware", href: "/hardware/boost-4820/" },
  { label: "Theory", href: "/theory/" },
];

export const legalLinks = [
  { label: "Imprint", href: "/imprint/" },
  { label: "Privacy", href: "/privacy/" },
  { label: "Contact", href: "/contact/" },
];
