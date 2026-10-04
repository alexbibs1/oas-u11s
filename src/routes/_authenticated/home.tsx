import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMyRole } from "@/lib/auth/view-as";
import { getHomeSummary } from "@/lib/feed/feed.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { qk } from "@/lib/query-keys";
import { BookOpen, GitCompare } from "lucide-react";
import { QueryError } from "@/components/query-error";
import { formatDateShort, formatUK } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return formatDateShort(d);
}

function fmtDateUK(d: string | null | undefined) {
  if (!d) return "—";
  return formatUK(d);
}

function HomePage() {
  const navigate = useNavigate();
  const { data: me } = useMyRole();
  const { data: summary, isError, refetch } = useQuery({
    queryKey: qk.feed.homeSummary,
    queryFn: () => getHomeSummary(),
  });

  if (isError)
    return (
      <main className="mx-auto max-w-2xl px-5 pt-8 pb-32">
        <QueryError onRetry={() => refetch()} />
      </main>
    );

  const displayName = me?.coachName ?? me?.username ?? "Coach";
  const next = summary?.nextSession;
  const feed = summary?.feed ?? [];

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-32">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">OA Rugby</p>
          <h1 className="mt-1 text-3xl font-bold text-primary">Welcome, {displayName}</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth", replace: true });
          }}
        >
          Sign out
        </Button>
      </header>

      <section className="space-y-4">
        <div>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/rules/u11"
              className="flex items-center justify-center gap-2 rounded-lg border bg-card px-3 py-3 text-sm font-semibold text-primary hover:bg-secondary"
            >
              <BookOpen className="h-4 w-4" />
              U11s Rules
            </Link>
            <Link
              to="/rules/u11-vs-u10"
              className="flex items-center justify-center gap-2 rounded-lg border bg-card px-3 py-3 text-sm font-semibold text-primary hover:bg-secondary"
            >
              <GitCompare className="h-4 w-4" />
              Differences vs U10s
            </Link>
          </div>
        </div>



        {next ? (
          <Link
            to={(next as any).session_type === "match" ? "/match-day" : "/session-info/$sessionId"}
            search={
              (next as any).session_type === "match"
                ? ({ sessionId: (next as any).id } as any)
                : undefined
            }
            params={
              (next as any).session_type === "match" ? undefined : { sessionId: (next as any).id }
            }
            className="block rounded-lg border bg-card p-5 hover:bg-secondary"
          >
            <h2 className="text-sm font-semibold text-muted-foreground">Next session</h2>
            <div className="mt-2">
              <p className="text-base font-semibold text-primary">
                {fmtDate((next as any).session_date)} ·{" "}
                {(next as any).session_type === "match" ? "Match" : "Training"}
              </p>
              {(next as any).session_type === "match" && (
                <p className="text-xs text-muted-foreground">
                  {(next as any).opponent ?? "TBC"}
                  {(next as any).venue ? ` · ${(next as any).venue}` : ""}
                </p>
              )}
            </div>
          </Link>
        ) : (
          <div className="rounded-lg border bg-card p-5">
            <h2 className="text-sm font-semibold text-muted-foreground">Next session</h2>
            <p className="mt-2 text-sm text-muted-foreground">Nothing scheduled.</p>
          </div>
        )}

        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">Latest news</h2>
            <Link to="/feed" className="text-xs font-semibold text-accent hover:underline">
              See all
            </Link>
          </div>
          {feed.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {feed.map((p: any) => (
                <li key={p.id} className="border-t pt-3 first:border-t-0 first:pt-0">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{p.coach_name ?? "Coach"}</span>{" "}
                    · {fmtDateUK(p.created_at)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm">{p.content}</p>
                  {p.is_player_note && p.player_name && (
                    <p className="mt-1 text-[11px] font-medium text-accent">
                      Player note · {p.player_name}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
