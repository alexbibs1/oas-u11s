import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { GroupingBadge } from "@/components/grouping-badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyRole } from "@/lib/auth/roles.functions";
import { listMatchSessions } from "@/lib/sessions/sessions.functions";
import { getMatchTeamBuilderData, saveMatchTeams } from "@/lib/match/match.functions";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateLong } from "@/lib/dates";
import { qk } from "@/lib/query-keys";

export const Route = createFileRoute("/_authenticated/match-teams")({
  validateSearch: (s: Record<string, unknown>) => ({
    sessionId: typeof s.sessionId === "string" ? s.sessionId : undefined,
  }),
  beforeLoad: async () => {
    const me = await getMyRole();
    if (!me.isAdmin) throw redirect({ to: "/home" });
  },
  component: MatchTeamsPage,
});

function quartileColor(q: number | null | undefined): string {
  switch (q) {
    case 1:
      return "bg-emerald-100 text-emerald-800";
    case 2:
      return "bg-blue-100 text-blue-800";
    case 3:
      return "bg-amber-100 text-amber-800";
    case 4:
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function MatchTeamsPage() {
  const { sessionId } = Route.useSearch();
  const [selected, setSelected] = useState<string | null>(sessionId ?? null);

  return (
    <main className="mx-auto max-w-3xl px-5 pt-8 pb-32">
      {!selected ? (
        <MatchList onPick={setSelected} />
      ) : (
        <TeamBuilder sessionId={selected} onBack={() => setSelected(null)} />
      )}
    </main>
  );
}

function MatchList({ onPick }: { onPick: (id: string) => void }) {
  const { data = [], isLoading } = useQuery({
    queryKey: qk.sessions.matchList,
    queryFn: () => listMatchSessions(),
  });

  return (
    <>
      <header className="mb-6">
        <Link to="/admin" className="text-xs text-muted-foreground hover:underline">
          <ChevronLeft className="inline h-3 w-3" /> Admin
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-primary">Match Teams</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick up to 5 teams for a fixture.
        </p>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data.length ? (
        <p className="text-sm text-muted-foreground">No matches scheduled yet.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((s: any) => (
            <li key={s.id}>
              <button
                onClick={() => onPick(s.id)}
                className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left hover:border-primary"
              >
                <div>
                  <p className="text-sm font-semibold">{formatDateLong(s.session_date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.opponent ? `vs ${s.opponent}` : "Match"}
                    {s.venue ? ` · ${s.venue}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">Pick teams →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

type TeamState = { coach_ids: string[]; player_ids: string[] };

function TeamBuilder({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: qk.match.builderData(sessionId),
    queryFn: () => getMatchTeamBuilderData({ data: { session_id: sessionId } }),
  });

  const [teams, setTeams] = useState<Record<number, TeamState>>({});

  useEffect(() => {
    if (!data) return;
    const init: Record<number, TeamState> = {};
    for (const t of data.teams as any[]) {
      init[t.team_number] = { coach_ids: t.coach_ids, player_ids: t.player_ids };
    }
    setTeams(init);
  }, [data]);

  const teamNumbers = Object.keys(teams)
    .map(Number)
    .sort((a, b) => a - b);

  const addTeam = () => {
    for (let n = 1; n <= 5; n++) {
      if (!teams[n]) {
        setTeams({ ...teams, [n]: { coach_ids: [], player_ids: [] } });
        return;
      }
    }
  };

  const removeTeam = (n: number) => {
    const next = { ...teams };
    delete next[n];
    setTeams(next);
  };

  const togglePlayer = (n: number, playerId: string) => {
    setTeams((prev) => {
      const next = { ...prev };
      // Remove from every other team first — a player is only ever on one team.
      for (const key of Object.keys(next)) {
        const num = Number(key);
        if (num !== n) {
          next[num] = {
            ...next[num],
            player_ids: next[num].player_ids.filter((id) => id !== playerId),
          };
        }
      }
      const cur = next[n] ?? { coach_ids: [], player_ids: [] };
      const has = cur.player_ids.includes(playerId);
      next[n] = {
        ...cur,
        player_ids: has ? cur.player_ids.filter((id) => id !== playerId) : [...cur.player_ids, playerId],
      };
      return next;
    });
  };

  const toggleCoach = (n: number, coachId: string) => {
    setTeams((prev) => {
      const cur = prev[n] ?? { coach_ids: [], player_ids: [] };
      const has = cur.coach_ids.includes(coachId);
      return {
        ...prev,
        [n]: {
          ...cur,
          coach_ids: has ? cur.coach_ids.filter((id) => id !== coachId) : [...cur.coach_ids, coachId],
        },
      };
    });
  };

  const save = useMutation({
    mutationFn: () =>
      saveMatchTeams({
        data: {
          session_id: sessionId,
          teams: teamNumbers.map((n) => ({
            team_number: n,
            coach_ids: teams[n].coach_ids,
            player_ids: teams[n].player_ids,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Teams saved");
      qc.invalidateQueries({ queryKey: qk.match.builderData(sessionId) });
      qc.invalidateQueries({ queryKey: qk.match.teamsForSession(sessionId) });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const assignedIds = new Set(teamNumbers.flatMap((n) => teams[n].player_ids));
  const unassigned = (data.players as any[]).filter((p) => !assignedIds.has(p.id));

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <button onClick={onBack} className="text-xs text-muted-foreground hover:underline">
            <ChevronLeft className="inline h-3 w-3" /> Matches
          </button>
          <h1 className="mt-1 text-2xl font-bold text-primary">
            {formatDateLong(data.session.session_date)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.session.opponent ? `vs ${data.session.opponent}` : "Match"}
            {data.session.venue ? ` · ${data.session.venue}` : ""}
          </p>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending || teamNumbers.length === 0}>
          {save.isPending ? "Saving…" : "Save teams"}
        </Button>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {teamNumbers.map((n) => (
          <div key={n} className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-primary">
                Team {n} <span className="text-xs font-normal text-muted-foreground">({teams[n].player_ids.length} players)</span>
              </h3>
              <button onClick={() => removeTeam(n)} aria-label={`Remove team ${n}`}>
                <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {(data.coaches as any[]).map((c) => {
                const active = teams[n].coach_ids.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCoach(n, c.id)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground",
                    )}
                  >
                    {c.coach_name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {teamNumbers.length < 5 && (
          <button
            onClick={addTeam}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" /> Add team
          </button>
        )}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
        Squad ({data.players.length}) — tap a player, then a team to assign them
      </h2>
      <ul className="space-y-1.5">
        {(data.players as any[]).map((p) => {
          const assignedTo = teamNumbers.find((n) => teams[n].player_ids.includes(p.id));
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {p.player_name}
                  <span
                    className={`ml-2 rounded px-1 py-0.5 text-[9px] font-bold ${quartileColor(p.quartile)}`}
                  >
                    Q{p.quartile ?? "—"}
                  </span>
                  <GroupingBadge value={p.player_grouping} />
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {teamNumbers.map((n) => (
                  <button
                    key={n}
                    onClick={() => togglePlayer(n, p.id)}
                    className={cn(
                      "h-7 w-7 rounded-md border text-xs font-bold",
                      assignedTo === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {unassigned.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {unassigned.length} player{unassigned.length === 1 ? "" : "s"} not yet on a team.
        </p>
      )}
    </>
  );
}
