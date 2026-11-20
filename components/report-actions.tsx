"use client";

import { useState } from "react";
import { useDemo } from "@/components/demo-store";
import { Button } from "@/components/ui/button";
import { DownloadCsv } from "@/components/download-csv";

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
  const [note, setNote] = useState(demo.overlay.notes[periodId] ?? "");
  const [message, setMessage] = useState("");

  async function downloadPdf() {
    const { pdf } = await import("@react-pdf/renderer");
    const { ReportDocument } = await import("@/components/report-document");
    const blob = await pdf(<ReportDocument title={title} meta={meta} summary={summary} rows={rows} note={note} />).toBlob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `because-${periodId}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("PDF downloaded.");
  }

  async function copy() {
    const text = [...summary, "", note ? `Manager's note: ${note}` : ""].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(text);
    setMessage("Summary copied.");
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-1">
        <span className="text-[12px] font-medium">Manager&apos;s note</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => demo.setNote(periodId, note)}
          rows={4}
          className="rounded-[6px] border border-border bg-surface p-2"
          placeholder="This note is included in the PDF."
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={downloadPdf}>
          Export PDF
        </Button>
        <DownloadCsv filename={`because-${periodId}.csv`} rows={csvRows} label="Export CSV" />
        <Button onClick={copy}>Copy summary</Button>
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
