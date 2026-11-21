export function QuestionBox({ action, hidden }: { action: string; hidden: Record<string, string> }) {
  return (
    <form className="mt-3 flex flex-wrap gap-2" action={action} method="get">
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <label className="sr-only" htmlFor="q">
        Question
      </label>
      <input id="q" name="q" placeholder="Why was Tuesday low?" className="field min-w-0 flex-1 sm:min-w-[240px]" />
      <button className="h-8 rounded-[4px] border border-primary bg-primary px-3 text-primary-foreground" type="submit">
        Ask
      </button>
    </form>
  );
}
