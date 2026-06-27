import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMatchSummary } from "@/lib/sessions/sessions.functions";
import { ChevronLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateLong } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/match-summary/$sessionId")({
  component: MatchSummaryPage,
});

import { SKILLS } from "@/lib/skills";

function MatchSummaryPage() {
  const { sessionId } = Route.useParams();
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["match-summary", sessionId],
    queryFn: () => getMatchSummary({ data: { session_id: sessionId } }),
  });

  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else router.navigate({ to: "/calendar" });
  };

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8">
      <header className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Match Summary
          </p>
          <h1 className="mt-1 text-2xl font-bold text-primary">
            {data?.session.opponent ? `vs ${data.session.opponent}` : "Match"}
          </h1>
          {data && (
            <p className="text-xs text-muted-foreground">
              {formatDateLong(data.session.session_date)}
              {data.session.venue ? (
                <span className="inline-flex items-center gap-1 ml-2">
                  <MapPin className="h-3 w-3" />
                  {data.session.venue}
                </span>
              ) : null}
              {" • "}
              {data.session.block_name}
            </p>
          )}
        </div>
      </header>


      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="space-y-6 pb-24">
        {data?.groups.map((g) => (
          <section key={g.id} className="rounded-lg border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-primary">Group {g.group_number}</h2>
              <p className="text-xs text-muted-foreground">
                {g.coaches.length ? g.coaches.join(", ") : "No coaches"}
              </p>
            </div>

            {!g.hasOverrides ? (
              <p className="text-sm italic text-muted-foreground">No register submitted.</p>
            ) : (
              <div className="space-y-3">
                <PlayerList label="Present" items={g.present} />
                <PlayerList label="Absent" items={g.absent} muted />
                {g.movedIn.length > 0 && (
                  <PlayerList label="Moved in" items={g.movedIn} />
                )}

                <div className="mt-4 border-t pt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Ratings
                  </p>
                  {!g.hasRatings ? (
                    <p className="text-xs italic text-muted-foreground">
                      Ratings not yet submitted.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground/70">
                            <th className="text-left font-normal py-1 pr-2">Player</th>
                            {SKILLS.map((s) => (
                              <th key={s.key} className="font-normal py-1 px-1 text-center">
                                {s.short}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {g.ratings.map((r) => (
                            <tr key={r.player_id} className="border-t border-border/40">
                              <td className="py-1.5 pr-2 text-foreground/90">{r.name}</td>
                              {SKILLS.map((s) => (
                                <td
                                  key={s.key}
                                  className="py-1.5 px-1 text-center text-muted-foreground/80 tabular-nums"
                                >
                                  {r.scores ? (r.scores as any)[s.key] ?? "–" : "–"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}

function PlayerList({
  label,
  items,
  muted = false,
}: {
  label: string;
  items: { id: string; name: string }[];
  muted?: boolean;
}) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label} <span className="font-normal">({items.length})</span>
      </p>
      <p className={`mt-1 text-sm ${muted ? "text-muted-foreground" : "text-foreground/90"}`}>
        {items.map((p) => p.name).join(", ")}
      </p>
    </div>
  );
}
