"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BatteryCharging, CornerDownLeft, FileText, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandItem {
  id: string;
  label: string;
  hint: string;
  href: string;
  group: "Pages" | "Assets" | "Reports";
  icon?: LucideIcon;
}

/** ⌘K / Ctrl+K: jump to any page, asset or report. A native <dialog> traps focus and closes on Escape. */
export function CommandMenu({ items }: { items: CommandItem[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [mac] = useState(() => typeof navigator === "undefined" || /Mac|iPhone|iPad/.test(navigator.platform));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((item) => `${item.label} ${item.hint} ${item.group}`.toLowerCase().includes(q)) : items;
  }, [items, query]);

  function open() {
    setQuery("");
    setIndex(0);
    dialog.current?.showModal();
    input.current?.focus();
  }

  function go(item: CommandItem | undefined) {
    if (!item) return;
    dialog.current?.close();
    router.push(item.href);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialog.current?.open) {
          dialog.current.close();
          return;
        }
        setQuery("");
        setIndex(0);
        dialog.current?.showModal();
        input.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = ["Pages", "Assets", "Reports"] as const;

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="flex h-8 min-w-0 items-center gap-2 rounded-[6px] border border-border bg-muted px-2 text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground lg:w-56 lg:px-3 2xl:w-72"
        aria-label="Search pages, assets and reports"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Search size={16} aria-hidden="true" />
        <span className="hidden truncate lg:inline">Search pages, assets, reports</span>
        <kbd suppressHydrationWarning className="num ml-auto hidden rounded-[4px] border border-border-strong px-1 text-[11px] leading-4 lg:inline">{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      <dialog
        ref={dialog}
        className="command-menu"
        aria-label="Search"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="flex h-12 items-center gap-2 border-b border-border px-4">
          <Search size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={input}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") setIndex((i) => Math.min(results.length - 1, i + 1));
              else if (event.key === "ArrowUp") setIndex((i) => Math.max(0, i - 1));
              else if (event.key === "Enter") go(results[index]);
              else return;
              event.preventDefault();
            }}
            placeholder="Go to a page, an asset or a report"
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={results[index] ? `cmd-${results[index].id}` : undefined}
          />
          <kbd className="num rounded-[4px] border border-border-strong px-1 text-[11px] leading-4 text-muted-foreground">Esc</kbd>
        </div>
        <ul id="command-results" role="listbox" aria-label="Results" className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-2 py-6 text-center text-muted-foreground">Nothing matches “{query}”.</li>}
          {groups.map((group) => {
            const rows = results.filter((item) => item.group === group);
            if (!rows.length) return null;
            return (
              <li key={group} role="presentation">
                <p className="label px-2 pb-1 pt-2">{group}</p>
                <ul role="presentation">
                  {rows.map((item) => {
                    const active = results[index]?.id === item.id;
                    const Icon = item.icon ?? (group === "Assets" ? BatteryCharging : FileText);
                    return (
                      <li
                        key={item.id}
                        id={`cmd-${item.id}`}
                        role="option"
                        aria-selected={active}
                        onPointerMove={() => setIndex(results.indexOf(item))}
                        onClick={() => go(item)}
                        className={cn("flex h-9 cursor-pointer items-center gap-2 rounded-[6px] px-2", active && "bg-primary-soft text-foreground")}
                      >
                        <Icon size={16} className={active ? "text-primary" : "text-muted-foreground"} aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                        <span className="ml-auto truncate text-[12px] text-muted-foreground">{item.hint}</span>
                        {active && <CornerDownLeft size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </dialog>
    </>
  );
}
