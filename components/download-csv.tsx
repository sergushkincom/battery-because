"use client";

import { Button } from "@/components/ui/button";

export function DownloadCsv({ filename, rows, label }: { filename: string; rows: Record<string, string | number>[]; label: string }) {
  return (
    <Button
      onClick={() => {
        if (!rows.length) return;
        const headers = Object.keys(rows[0]);
        const body = [
          headers.join(","),
          ...rows.map((row) => headers.map((header) => csv(row[header])).join(",")),
        ].join("\n");
        const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
      }}
    >
      {label}
    </Button>
  );
}

function csv(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
