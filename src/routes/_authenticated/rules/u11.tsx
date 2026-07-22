import { createFileRoute, Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft } from "lucide-react";
import rulesContent from "@/content/u11-rules.md?raw";

export const Route = createFileRoute("/_authenticated/rules/u11")({
  head: () => ({
    meta: [
      { title: "U11s Rules of Play — OA Rugby" },
      { name: "description", content: "Full U11s rules of play reference for OA Rugby coaches." },
      { property: "og:title", content: "U11s Rules of Play — OA Rugby" },
      { property: "og:description", content: "Full U11s rules of play reference." },
    ],
  }),
  component: U11RulesPage,
});

function U11RulesPage() {
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
        <h1 className="mt-1 text-3xl font-bold text-primary">U11s Rules of Play</h1>
      </header>
      <article className="rounded-lg border bg-card p-6 prose prose-sm max-w-none prose-headings:text-primary prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-lg prose-h2:mt-6 prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{rulesContent}</ReactMarkdown>
      </article>
    </main>
  );
}
