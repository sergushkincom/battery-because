export function QuestionBox({ action, hidden }: { action: string; hidden: Record<string, string> }) {
  return (
    <form className="mt-3 flex flex-wrap gap-2" action={action} method="get">
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <label className="sr-only" htmlFor="q">
        Question
      </label>
      <input id="q" name="q" placeholder="Why was Tuesday low?" className="h-8 min-w-[240px] flex-1 rounded-[4px] border border-border bg-surface px-2" />
      <button className="h-8 rounded-[4px] border border-primary bg-primary px-3 text-primary-foreground" type="submit">
        Ask
      </button>
    </form>
  );
}
