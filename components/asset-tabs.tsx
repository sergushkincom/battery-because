import Link from "next/link";

const TABS = [
  ["day", "Day", ""],
  ["why", "Why", "/why"],
  ["control", "Control", "/control"],
  ["log", "Log", "/log"],
  ["journey", "Journey", "/journey"],
] as const;

export type AssetTab = (typeof TABS)[number][0];

/** The same five tabs on every asset page, so you can always get back. */
export function AssetTabs({ assetId, active, href }: { assetId: string; active: AssetTab; href: (path: string) => string }) {
  return (
    <nav className="subnav" aria-label="Asset">
      {TABS.map(([key, label, suffix]) => (
        <Link key={key} href={href(`/assets/${assetId}${suffix}`)} aria-current={key === active ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
