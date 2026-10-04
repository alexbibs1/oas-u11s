import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listMatchSessions } from "@/lib/sessions/sessions.functions";
import { getMatchCompletion } from "@/lib/match/match.functions";
import { qk } from "@/lib/query-keys";
import { QueryError } from "@/components/query-error";

export function CompletionTrackerSection() {
  const {
    data: matches,
    isError: matchesError,
    refetch: refetchMatches,
  } = useQuery({
    queryKey: qk.sessions.matchList,
    queryFn: () => listMatchSessions(),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const activeId = selected ?? matches?.[0]?.id ?? null;
  const { data: tracker } = useQuery({
    queryKey: qk.sessions.completion.detail(activeId),
    queryFn: () => getMatchCompletion({ data: { session_id: activeId! } }),
    enabled: !!activeId,
  });
  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-1 text-sm font-semibold">Match rating completion</h3>
      <p className="mb-3 text-xs text-muted-foreground">Per-team status for a selected match.</p>
      {matchesError ? (
        <QueryError message="Couldn't load matches" onRetry={() => refetchMatches()} />
      ) : matches?.length ? (
        <select
          value={activeId ?? ""}
          onChange={(e) => setSelected(e.target.value)}
          className="mb-4 w-full rounded-md border bg-background px-2 py-1 text-sm"
        >
          {matches.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.session_date}
              {s.opponent ? ` · vs ${s.opponent}` : ""}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-xs text-muted-foreground">No matches yet.</p>
      )}
      {tracker && (
        <ul className="space-y-2">
          {tracker.teams.map((t: any) => {
            const palette =
              t.status === "submitted"
                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                : t.status === "partial"
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-slate-100 text-slate-700 border-slate-300";
            const label =
              t.status === "submitted"
                ? "Submitted"
                : t.status === "partial"
                  ? `Partial (${t.rated}/${t.expected})`
                  : "Not started";
            return (
              <li key={t.team_id} className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Team {t.team_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.coaches.length ? t.coaches.join(", ") : "No coaches"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${palette}`}
                  >
                    {label}
                  </span>
                </div>
                {(t.status === "submitted" || t.status === "partial") && activeId && (
                  <Link
                    to="/match-summary/$sessionId"
                    params={{ sessionId: activeId }}
                    className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                  >
                    View ratings →
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
