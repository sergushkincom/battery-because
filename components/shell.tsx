"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/components/demo-store";
import { DEMO_NOW } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface ShellAsset {
  id: string;
  name: string;
  portfolioId: string;
}

export interface ShellPortfolio {
  id: string;
  name: string;
}

const NAV = [
  { href: "/", label: "Portfolio" },
  { href: "/assets", label: "Assets" },
  { href: "/markets", label: "Markets" },
  { href: "/ops", label: "Decisions" },
  { href: "/reports", label: "Reports" },
];

export function Shell({
  children,
  portfolios,
  assets,
  pendingSeed,
}: {
  children: React.ReactNode;
  portfolios: ShellPortfolio[];
  assets: ShellAsset[];
  pendingSeed: number;
}) {
  const path = usePathname();
  const sp = useSearchParams();
  const { overlay, reset } = useDemo();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(DEMO_NOW);
  const role = sp.get("role") || "owner";
  const portfolio = sp.get("portfolio") || (role === "stadtwerk" ? "elbe" : "kestrel");
  const period = sp.get("period") || "7d";
  const loc = sp.get("loc") || "en-GB";

  useEffect(() => {
    const origin = Date.now();
    const base = Date.parse(DEMO_NOW);
    const id = window.setInterval(() => setNow(new Date(base + (Date.now() - origin)).toISOString()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const pending = Math.max(0, pendingSeed - (overlay.approvals["apr-puglia-cycles"] ? 1 : 0));

  const clock = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Berlin",
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(now));

  function href(nextPath: string, patch: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value == null) params.delete(key);
      else params.set(key, value);
    }
    const q = params.toString();
    return q ? `${nextPath}?${q}` : nextPath;
  }

  const keep = href;
  const width = collapsed ? "md:w-12" : "md:w-[232px]";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-surface focus:px-2 focus:py-1">
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <aside className={cn("fixed inset-y-0 left-0 z-40 w-[232px] border-r border-border bg-surface md:static", width, open ? "block" : "hidden md:block")}>
          <div className="flex h-12 items-center justify-between border-b border-border px-3">
            {collapsed ? <span className="num px-1 text-[14px] font-semibold">B</span> : <span className="text-[16px] font-semibold">Because</span>}
            <button className="hidden rounded-[4px] px-1 text-muted-foreground md:inline" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={() => setCollapsed((v) => !v)}>
              {collapsed ? "»" : "«"}
            </button>
          </div>
          <nav className="flex flex-col gap-0.5 p-2" aria-label="Primary">
            {NAV.map((item) => {
              const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={keep(item.href, {})}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex h-8 items-center rounded-[4px] px-2",
                    active ? "font-medium text-primary shadow-[inset_2px_0_0_var(--primary)]" : "text-foreground hover:bg-muted",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {collapsed ? item.label.slice(0, 1) : item.label}
                </Link>
              );
            })}
          </nav>
          {!collapsed && (
            <div className="mt-4 border-t border-border px-3 py-3 text-[12px] text-muted-foreground">
              <Link href={keep("/log", {})} className="block py-1 hover:text-foreground">
                Audit log
              </Link>
              <p className="pt-3">Synthetic demo. Europe/Berlin.</p>
              <button className="mt-2 underline" onClick={reset}>
                Reset demo
              </button>
            </div>
          )}
        </aside>
        {open && <button className="fixed inset-0 z-30 bg-black/40 md:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border bg-surface px-3 md:px-6">
            <button className="rounded-[4px] border border-border px-2 py-1 md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
              Menu
            </button>
            <label className="sr-only" htmlFor="portfolio">
              Portfolio
            </label>
            <select
              id="portfolio"
              className="h-8 max-w-[180px] rounded-[4px] border border-border bg-surface px-2"
              value={portfolio}
              onChange={(e) => {
                window.location.href = href(path, { portfolio: e.target.value });
              }}
            >
              {portfolios.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div className="hidden items-center gap-1 md:flex" role="group" aria-label="Period">
              {(
                [
                  ["yesterday", "Yesterday"],
                  ["7d", "7 d"],
                  ["mtd", "MTD"],
                  ["ytd", "Window"],
                ] as const
              ).map(([key, label]) => (
                <Link
                  key={key}
                  href={href(path, { period: key })}
                  className={cn("rounded-[4px] px-2 py-1", period === key ? "bg-muted font-medium text-primary" : "text-muted-foreground")}
                  aria-current={period === key ? "true" : undefined}
                >
                  {label}
                </Link>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <p className="num hidden text-[12px] text-muted-foreground lg:block">
                <time dateTime={now}>{clock}</time>
                <span className="ml-1">Europe/Berlin</span>
              </p>
              <Link
                href={keep("/ops", {})}
                className={cn(
                  "rounded-[4px] border px-2 py-1 text-[12px]",
                  pending > 0 ? "border-accent text-needs" : "border-border text-system",
                )}
              >
                {pending > 0 ? `Needs a decision (${pending})` : "System running"}
              </Link>
              <Link href={href(path, { loc: loc === "de-DE" ? "en-GB" : "de-DE" })} className="num rounded-[4px] border border-border px-2 py-1 text-[12px]" aria-label="Toggle number format">
                {loc === "de-DE" ? "DE" : "EN"}
              </Link>
              <ThemeButton />
              <label className="sr-only" htmlFor="role">
                Role
              </label>
              <select
                id="role"
                className="h-8 rounded-[4px] border border-border bg-surface px-2"
                value={role}
                onChange={(e) => {
                  const next = e.target.value;
                  const dest = next === "operator" ? "/ops" : next === "stadtwerk" ? "/assets" : "/";
                  window.location.href = href(dest, { role: next, portfolio: next === "stadtwerk" ? "elbe" : "kestrel" });
                }}
              >
                <option value="owner">Asset owner</option>
                <option value="stadtwerk">Stadtwerk</option>
                <option value="operator">Operator</option>
              </select>
            </div>
          </header>
          <main id="content" className="flex-1 p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
      <span className="sr-only">{assets.length}</span>
    </div>
  );
}

function subscribeTheme(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function ThemeButton() {
  const dark = useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
  return (
    <Button
      size="sm"
      variant="outline"
      aria-pressed={dark}
      onClick={() => {
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("because-theme", next ? "dark" : "light");
      }}
    >
      {dark ? "Light" : "Dark"}
    </Button>
  );
}
