export default function Loading() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-live="polite">
      <div className="h-6 w-48 rounded-[4px] bg-muted" />
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-[6px] border border-border bg-card" />
        ))}
      </div>
      <div className="h-64 rounded-[6px] border border-border bg-card" />
    </div>
  );
}
