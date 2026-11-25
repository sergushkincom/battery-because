"use client";

import { useState } from "react";
import { Copy, Download, FileText } from "lucide-react";
import { useDemo } from "@/components/demo-store";
import { Button } from "@/components/ui/button";

export function ReportActions({
  periodId,
  title,
  meta,
  summary,
  rows,
  csvRows,
}: {
  periodId: string;
  title: string;
  meta: string;
  summary: string[];
  rows: { label: string; value: string }[];
  csvRows: Record<string, string | number>[];
}) {
  const demo = useDemo();
  const [message, setMessage] = useState("");
  const note = demo.overlay.notes[periodId] ?? "";

  async function downloadPdf() {
    const { pdf } = await import("@react-pdf/renderer");
    const { ReportDocument } = await import("@/components/report-document");
    const blob = await pdf(<ReportDocument title={title} meta={meta} summary={summary} rows={rows} note={note} />).toBlob();
    save(blob, `because-${periodId}.pdf`);
    setMessage("PDF downloaded");
  }

  function downloadCsv() {
    if (!csvRows.length) return;
    const headers = Object.keys(csvRows[0]);
    const body = [headers.join(","), ...csvRows.map((row) => headers.map((header) => csv(row[header])).join(","))].join("\n");
    save(new Blob([body], { type: "text/csv;charset=utf-8" }), `because-${periodId}.csv`);
    setMessage("CSV downloaded");
  }

  async function copy() {
    const text = [...summary, "", note ? `Manager's note: ${note}` : ""].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(text);
    setMessage("Summary copied");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p role="status" className="mr-1 text-[12px] text-muted-foreground">
        {message}
      </p>
      <Button variant="ghost" onClick={copy}>
        <Copy size={14} aria-hidden="true" /> Copy summary
      </Button>
      <Button variant="ghost" onClick={downloadCsv}>
        <Download size={14} aria-hidden="true" /> Export CSV
      </Button>
      <Button variant="primary" onClick={downloadPdf}>
        <FileText size={14} aria-hidden="true" /> Export PDF
      </Button>
    </div>
  );
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csv(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
