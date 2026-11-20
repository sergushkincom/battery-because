"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="max-w-lg rounded-[6px] border border-border bg-card p-4">
      <h1 className="text-[20px] font-semibold">This view failed to render</h1>
      <p className="mt-2 text-muted-foreground">The numbers on this screen were not updated. The book itself is unchanged.</p>
      <button className="mt-4 rounded-[4px] border border-border px-3 py-1" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
