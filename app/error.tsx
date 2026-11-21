"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="max-w-lg card p-5">
      <h1 className="page-title">This view failed to render</h1>
      <p className="mt-2 text-muted-foreground">The numbers on this screen were not updated. The book itself is unchanged.</p>
      <button className="mt-4 inline-flex h-8 items-center rounded-[6px] border border-border-strong bg-surface px-3 font-medium hover:bg-muted" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
