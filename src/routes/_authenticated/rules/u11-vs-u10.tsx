import { createFileRoute, Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft } from "lucide-react";
import content from "@/content/u11-vs-u10.md?raw";

export const Route = createFileRoute("/_authenticated/rules/u11-vs-u10")({
  head: () => ({
    meta: [
      { title: "Differences: U11s vs U10s — OA Rugby" },
      { name: "description", content: "Key rule changes moving from U10s to U11s." },
      { property: "og:title", content: "Differences: U11s vs U10s — OA Rugby" },
      { property: "og:description", content: "Key rule changes moving from U10s to U11s." },
    ],
  }),
  component: U11VsU10Page,
});

function U11VsU10Page() {
  return (
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-32">
      <Link
        to="/home"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Rules</p>
        <h1 className="mt-1 text-3xl font-bold text-primary">Differences: U11s vs U10s</h1>
      </header>
      <article className="rounded-lg border bg-card p-6 prose prose-sm max-w-none prose-headings:text-primary prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-lg prose-h2:mt-6 prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </article>
    </main>
  );
}
