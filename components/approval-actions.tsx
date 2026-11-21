"use client";

import { useState } from "react";
import { useDemo } from "@/components/demo-store";
import { Button } from "@/components/ui/button";
import type { ApprovalRequest, Role } from "@/lib/types";

const ACTOR: Record<Role, string> = {
  owner: "Jonas Adler",
  stadtwerk: "Lina Krüger",
  operator: "Mara Keller",
};

export function ApprovalActions({ item, role }: { item: ApprovalRequest; role: Role }) {
  const demo = useDemo();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const overlay = demo.overlay.approvals[item.id] as
    | { state: "approved" | "rejected"; resolvedBy: string; note?: string }
    | undefined;
  // An expired request already says so in its chip; repeating it here was noise.
  if (!overlay && item.state !== "pending") return null;
  if (overlay) {
    const state = overlay?.state ?? item.state;
    return (
      <p className="text-[12px] text-muted-foreground">
        {state === "approved" ? `Approved by ${overlay?.resolvedBy}` : state === "rejected" ? `Rejected. ${overlay?.note ?? ""}` : "Expired — system used safe default"}
      </p>
    );
  }
  if (role !== "operator") {
    return <p className="text-[12px] text-muted-foreground">Only the operator can approve this. Switch role to act.</p>;
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button
        variant="primary"
        size="sm"
        onClick={() => demo.approve({ id: item.id, assetId: item.assetId, action: item.action }, ACTOR[role], role)}
      >
        Approve
      </Button>
      <Button variant="accent" size="sm" onClick={() => demo.approve({ id: item.id, assetId: item.assetId, action: item.action }, ACTOR[role], role)}>
        Approve once
      </Button>
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        Reject
      </Button>
      {open && (
        <form
          className="flex w-full gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            demo.reject({ id: item.id, assetId: item.assetId, action: item.action }, ACTOR[role], role, note);
          }}
        >
          <label className="sr-only" htmlFor={`why-${item.id}`}>
            Why reject
          </label>
          <input id={`why-${item.id}`} value={note} onChange={(e) => setNote(e.target.value)} required className="field flex-1" placeholder="Why this is rejected" />
          <Button type="submit" variant="destructive" size="sm">
            Confirm reject
          </Button>
        </form>
      )}
    </div>
  );
}
