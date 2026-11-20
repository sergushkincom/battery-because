import Link from "next/link";

export default function NotFound() {
  return (
    <section className="max-w-lg rounded-[6px] border border-border bg-card p-4">
      <h1 className="text-[20px] font-semibold">That page is not in the book</h1>
      <p className="mt-2 text-muted-foreground">The asset or report does not exist in this demo.</p>
      <Link href="/" className="mt-4 inline-block text-primary">
        Back to the portfolio
      </Link>
    </section>
  );
}
