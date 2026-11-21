import Link from "next/link";

export default function NotFound() {
  return (
    <section className="max-w-lg card p-5">
      <h1 className="page-title">That page is not in the book</h1>
      <p className="mt-2 text-muted-foreground">The asset or report does not exist in this demo.</p>
      <Link href="/" className="mt-4 inline-block link">
        Back to the portfolio
      </Link>
    </section>
  );
}
