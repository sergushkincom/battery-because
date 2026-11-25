"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { BatteryCharging, ChartLine, FileText, LayoutDashboard, ListChecks, Menu, Moon, PanelLeftClose, PanelLeftOpen, RotateCcw, ScrollText, Sun, X, Zap } from "lucide-react";
import { CommandMenu, type CommandItem } from "@/components/command-menu";
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
  { href: "/", label: "Portfolio", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: BatteryCharging },
  { href: "/markets", label: "Markets", icon: ChartLine },
  { href: "/ops", label: "Decisions", icon: ListChecks },
  { href: "/reports", label: "Reports", icon: FileText },
];
const AUDIT = { href: "/log", label: "Audit log", icon: ScrollText };

const PERIODS = [
  ["yesterday", "Yesterday"],
  ["7d", "7 d"],
  ["mtd", "MTD"],
  ["ytd", "Window"],
] as const;

export function Shell({
  children,
  portfolios,
  assets,
  pendingSeed,
  reports,
}: {
  children: React.ReactNode;
  portfolios: ShellPortfolio[];
  assets: ShellAsset[];
  pendingSeed: number;
  reports: { id: string; label: string; range: string }[];
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

  const commands: CommandItem[] = [
    ...[...NAV, AUDIT].map((item) => ({ id: `page${item.href}`, label: item.label, hint: "Page", href: keep(item.href, {}), group: "Pages" as const, icon: item.icon })),
    ...assets
      .filter((item) => item.portfolioId === portfolio)
      .map((item) => ({ id: `asset-${item.id}`, label: item.name, hint: portfolios.find((p) => p.id === item.portfolioId)?.name ?? "", href: keep(`/assets/${item.id}`, {}), group: "Assets" as const })),
    ...reports.map((item) => ({ id: `report-${item.id}`, label: item.label, hint: item.range, href: keep(`/reports/${item.id}`, {}), group: "Reports" as const })),
  ];

  // Switching portfolio on an asset that belongs to another portfolio would leave that asset on screen.
  function portfolioHref(next: string) {
    const assetId = path.startsWith("/assets/") ? path.split("/")[2] : null;
    const owner = assetId ? assets.find((item) => item.id === assetId)?.portfolioId : null;
    const dest = owner && owner !== next ? "/assets" : path;
    return href(dest, { portfolio: next, date: owner && owner !== next ? null : sp.get("date") });
  }

  function roleHref(next: string) {
    const dest = next === "operator" ? "/ops" : next === "stadtwerk" ? "/assets" : "/";
    return href(dest, { role: next, portfolio: next === "stadtwerk" ? "elbe" : "kestrel" });
  }

  const periodLinks = PERIODS.map(([key, label]) => (
    <Link key={key} href={href(path, { period: key })} aria-current={period === key ? "true" : undefined}>
      {label}
    </Link>
  ));

  const roleSelect = (id: string) => (
    <>
      <label className="sr-only" htmlFor={id}>
        Role
      </label>
      <select id={id} className="field w-auto" value={role} onChange={(e) => (window.location.href = roleHref(e.target.value))}>
        <option value="owner">Asset owner</option>
        <option value="stadtwerk">Stadtwerk</option>
        <option value="operator">Operator</option>
      </select>
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-[6px] focus:bg-surface focus:px-3 focus:py-1.5 focus:shadow-[var(--shadow-pop)]">
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "dark fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-border bg-sidebar text-foreground transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] md:sticky md:top-0 md:z-30 md:h-screen",
            collapsed ? "md:w-[60px]" : "md:w-[228px]",
            open ? "flex" : "hidden md:flex",
          )}
          aria-label="Navigation"
        >
          <div className={cn("flex h-12 shrink-0 items-center gap-2 px-3", collapsed && "md:justify-center md:px-0")}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-primary text-primary-foreground" aria-hidden="true">
              <Zap size={16} />
            </span>
            <span className={cn("text-[15px] font-semibold tracking-[-0.01em]", collapsed && "md:hidden")}>Because</span>
            <button className="ml-auto flex size-8 items-center justify-center rounded-[6px] text-muted-foreground hover:bg-muted hover:text-foreground md:hidden" aria-label="Close menu" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <nav className="flex flex-col gap-0.5 px-2 pt-1" aria-label="Primary">
            {[...NAV, AUDIT].map((item) => {
              const active = item.href === "/" ? path === "/" : item.href === "/log" ? path === "/log" : path.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={keep(item.href, {})}
                  onClick={() => setOpen(false)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex h-8 items-center gap-2.5 rounded-[6px] px-2.5 transition-colors",
                    collapsed && "md:justify-center md:px-0",
                    item === AUDIT && "mt-3",
                    active ? "bg-primary-soft font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={16} className="shrink-0" aria-hidden="true" />
                  <span className={cn("truncate", collapsed && "md:sr-only")}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Mobile only: the header controls that don't fit on a phone. */}
          <div className="mt-4 grid gap-3 border-t border-border px-3 pt-4 md:hidden">
            <p className="label">Period</p>
            <div className="segmented w-fit" role="group" aria-label="Period">
              {periodLinks}
            </div>
            <p className="label">Role</p>
            {roleSelect("role-mobile")}
            <Link href={href(path, { loc: loc === "de-DE" ? "en-GB" : "de-DE" })} className="link w-fit text-[12px]">
              Numbers: {loc === "de-DE" ? "German format" : "English format"}
            </Link>
          </div>

          <div className={cn("mt-auto border-t border-border px-3 py-3 text-[12px] text-muted-foreground", collapsed && "md:hidden")}>
            <p>Synthetic demo · Europe/Berlin</p>
            <button className="mt-1.5 inline-flex items-center gap-1.5 rounded-[6px] py-0.5 text-foreground hover:text-primary" onClick={reset}>
              <RotateCcw size={13} aria-hidden="true" /> Reset demo
            </button>
          </div>
          <div className={cn("hidden border-t border-border p-2 md:block", collapsed && "md:flex md:justify-center")}>
            <button
              className="flex h-8 items-center gap-2 rounded-[6px] px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              title={collapsed ? "Expand navigation" : "Collapse navigation"}
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              {!collapsed && <span className="text-[12px]">Collapse</span>}
            </button>
          </div>
        </aside>
        {open && <button className="fixed inset-0 z-40 bg-black/40 md:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border bg-surface px-4 md:px-6">
            <button className="flex size-8 shrink-0 items-center justify-center rounded-[6px] border border-border-strong text-foreground hover:bg-muted md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
              <Menu size={16} />
            </button>
            <label className="sr-only" htmlFor="portfolio">
              Portfolio
            </label>
            <select
              id="portfolio"
              className="field w-auto min-w-0 max-w-[48vw] shrink font-medium sm:max-w-[240px] md:shrink-0"
              value={portfolio}
              onChange={(e) => {
                window.location.href = portfolioHref(e.target.value);
              }}
            >
              {portfolios.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div className="segmented hidden shrink-0 md:inline-flex" role="group" aria-label="Period">
              {periodLinks}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <CommandMenu items={commands} />
              <p className="num hidden whitespace-nowrap pr-1 text-[12px] text-muted-foreground xl:block">
                <time dateTime={now}>{clock}</time>
                <span className="ml-1.5">Berlin</span>
              </p>
              <Link
                href={keep("/ops", {})}
                title={pending > 0 ? `Needs a decision (${pending})` : "System running"}
                className={cn(
                  "inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-[12px] font-medium transition-colors",
                  pending > 0 ? "border-accent/40 bg-accent-soft text-needs hover:border-accent" : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative flex size-2">
                  {pending > 0 && <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-50 motion-reduce:hidden" />}
                  <span className={cn("relative size-2 rounded-full", pending > 0 ? "bg-accent" : "bg-up")} />
                </span>
                <span className="hidden xl:inline">{pending > 0 ? "Needs a decision" : "System running"}</span>
                {pending > 0 && <span className="num">{pending}</span>}
              </Link>
              <Link
                href={href(path, { loc: loc === "de-DE" ? "en-GB" : "de-DE" })}
                className="num hidden h-8 w-9 items-center justify-center rounded-[6px] text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
                aria-label={loc === "de-DE" ? "Numbers in German format. Switch to English" : "Numbers in English format. Switch to German"}
                title="Number format"
              >
                {loc === "de-DE" ? "DE" : "EN"}
              </Link>
              <ThemeButton />
              <div className="hidden md:block">{roleSelect("role")}</div>
            </div>
          </header>
          <main id="content" className="appear flex-1 p-4 md:p-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1440px]">{children}</div>
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
    <button
      className="flex size-8 items-center justify-center rounded-[6px] text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-pressed={dark}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      onClick={() => {
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("because-theme", next ? "dark" : "light");
      }}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
