import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMyRole } from "@/lib/auth/roles.functions";
import { getHomeSummary } from "@/lib/feed/feed.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function HomePage() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMyRole() });
  const { data: summary } = useQuery({
    queryKey: ["home-summary"],
    queryFn: () => getHomeSummary(),
  });

  const displayName = me?.coachName ?? me?.username ?? "Coach";
  const block = summary?.block;
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
            window.location.href = "/auth";
          }}
        >
          Sign out
        </Button>
      </header>

      <section className="space-y-4">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Current block</h2>
          {block ? (
            <>
              <p className="mt-2 text-base font-semibold text-primary">
                {(block as any).name ?? `Block ${(block as any).block_number}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtDate((block as any).start_date)} – {fmtDate((block as any).end_date)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No active block.</p>
          )}
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Your group this block</h2>
          {summary?.myGroup ? (
            <>
              <p className="mt-2 text-base font-semibold text-primary">
                Group {summary.myGroup.group_number}
              </p>
              {summary.myGroup.coach_names && summary.myGroup.coach_names.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Coach {summary.myGroup.coach_names.join(", ")}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Not assigned to a group.</p>
          )}
        </div>

        {next ? (
          <Link
            to={
              (next as any).session_type === "match"
                ? "/match-day"
                : "/session-info/$sessionId"
            }
            search={
              (next as any).session_type === "match"
                ? ({ sessionId: (next as any).id } as any)
                : undefined
            }
            params={
              (next as any).session_type === "match"
                ? undefined
                : { sessionId: (next as any).id }
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
                    <span className="font-semibold text-foreground">
                      {p.coach_name ?? "Coach"}
                    </span>{" "}
                    · {new Date(p.created_at).toLocaleDateString()}
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
