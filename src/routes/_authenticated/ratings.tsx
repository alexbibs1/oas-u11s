import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { listMatchSessions } from "@/lib/sessions/sessions.functions";
import {
  getMatchTeamsForSession,
  getMatchDayContext,
  submitRatings,
} from "@/lib/match/match.functions";
import { SKILLS, SKILL_DESCRIPTORS } from "@/lib/skills";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDateLong } from "@/lib/dates";
import { qk } from "@/lib/query-keys";
import { useConfirm } from "@/components/confirm-dialog";
import { QueryError } from "@/components/query-error";

export const Route = createFileRoute("/_authenticated/ratings")({
  component: RatingsPage,
});

function RatingsPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-3">
        {(sessionId || teamId) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (teamId) setTeamId(null);
              else setSessionId(null);
            }}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Match ratings
          </p>
          <h1 className="mt-1 text-2xl font-bold text-primary">
            {!sessionId && "Pick a match"}
            {sessionId && !teamId && "Pick a team"}
            {sessionId && teamId && "Score players"}
          </h1>
        </div>
      </header>

      {!sessionId && <MatchPicker onPick={setSessionId} />}
      {sessionId && !teamId && <TeamPicker sessionId={sessionId} onPick={setTeamId} />}
      {sessionId && teamId && (
        <RatingsEntry
          sessionId={sessionId}
          teamId={teamId}
          onDone={() => {
            setTeamId(null);
          }}
        />
      )}
    </main>
  );
}

function MatchPicker({ onPick }: { onPick: (id: string) => void }) {
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: qk.sessions.matchList,
    queryFn: () => listMatchSessions(),
  });
  if (isError) return <QueryError onRetry={() => refetch()} />;
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data.length)
    return (
      <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        No matches scheduled.
      </p>
    );
  return (
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
            <span className="text-xs text-muted-foreground">Open →</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function TeamPicker({ sessionId, onPick }: { sessionId: string; onPick: (id: string) => void }) {
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: qk.match.teamsForSession(sessionId),
    queryFn: () => getMatchTeamsForSession({ data: { session_id: sessionId } }),
  });
  if (isError) return <QueryError onRetry={() => refetch()} />;
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data.length)
    return (
      <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        No teams picked for this match yet.
      </p>
    );
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {data.map((t: any) => (
        <li key={t.id}>
          <button
            onClick={() => onPick(t.id)}
            className="flex w-full flex-col items-start gap-1 rounded-lg border bg-card p-4 text-left hover:border-primary"
          >
            <p className="text-base font-bold text-primary">Team {t.team_number}</p>
            <p className="text-xs text-muted-foreground">
              {t.coaches.length ? t.coaches.join(", ") : "—"}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}

type Scores = Record<string, Record<string, number>>;

function RatingsEntry({
  sessionId,
  teamId,
  onDone,
}: {
  sessionId: string;
  teamId: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: ctx, isLoading, isError, refetch } = useQuery({
    queryKey: qk.match.context(sessionId, teamId),
    queryFn: () => getMatchDayContext({ data: { session_id: sessionId, team_id: teamId } }),
    staleTime: 0,
  });

  const presentPlayers = useMemo(() => {
    if (!ctx) return [] as any[];
    const overrideById = new Map((ctx.overrides as any[]).map((o) => [o.player_id, o]));
    const here = (ctx.defaultRoster as any[]).filter((p) => {
      const ov = overrideById.get(p.id);
      if (!ov) return true;
      return ov.override_team_id === teamId;
    });
    return [...here, ...(ctx.movedInPlayers as any[])];
  }, [ctx, teamId]);

  const [scores, setScores] = useState<Scores>({});
  const [potdId, setPotdId] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx) return;
    const init: Scores = {};
    const existingByPid = new Map((ctx.ratings as any[]).map((r) => [r.player_id, r]));
    for (const p of presentPlayers) {
      const ex = existingByPid.get(p.id);
      init[p.id] = {};
      for (const s of SKILLS) {
        init[p.id][s.key] = ex ? (ex as any)[s.key] : ((p as any)[s.key] ?? 3);
      }
    }
    setScores(init);
    const existingPotd = (ctx.ratings as any[]).find((r) => r.player_of_the_day);
    setPotdId(existingPotd?.player_id ?? null);
  }, [ctx, presentPlayers]);

  const hasExisting = (ctx?.ratings as any[] | undefined)?.length ?? 0;

  const handleSubmit = async () => {
    if (hasExisting) {
      const ok = await confirm({
        title: "Overwrite existing ratings?",
        description: "Ratings already exist for this team/session. Submitting will overwrite them.",
        confirmLabel: "Overwrite",
        destructive: true,
      });
      if (!ok) return;
    }
    submit.mutate();
  };

  const submit = useMutation({
    mutationFn: () =>
      submitRatings({
        data: {
          session_id: sessionId,
          team_id: teamId,
          ratings: presentPlayers.map((p: any) => ({
            player_id: p.id,
            carrying: scores[p.id]?.carrying ?? 3,
            handling: scores[p.id]?.handling ?? 3,
            tackling: scores[p.id]?.tackling ?? 3,
            rucking: scores[p.id]?.rucking ?? 3,
            kicking: scores[p.id]?.kicking ?? 3,
            iq: scores[p.id]?.iq ?? 3,
          })),
          player_of_the_day_id: potdId,
        },
      }),
    onSuccess: (r: any) => {
      toast.success(`Saved ratings for ${r.count} player${r.count === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: qk.match.context(sessionId, teamId) });
      qc.invalidateQueries({ queryKey: qk.sessions.completion.all });
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isError) return <QueryError onRetry={() => refetch()} />;
  if (isLoading || !ctx) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!presentPlayers.length)
    return (
      <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        <p className="font-semibold text-primary">No players to rate yet</p>
        <p className="mt-1">
          Submit the attendance register for this team on Match Day before entering ratings.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => (window.location.href = "/match-day")}
        >
          Go to Match Day
        </Button>
      </div>
    );

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {(presentPlayers as any[]).map((p) => (
          <li key={p.id} className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-base font-bold text-primary">{p.player_name}</p>
            <div className="space-y-2">
              {SKILLS.map((sk) => {
                const v = scores[p.id]?.[sk.key] ?? 3;
                return (
                  <div key={sk.key} className="flex items-center justify-between gap-2">
                    <span className="w-24 text-xs text-muted-foreground">{sk.label}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          title={SKILL_DESCRIPTORS[n]}
                          onClick={() =>
                            setScores((s) => ({
                              ...s,
                              [p.id]: { ...(s[p.id] ?? {}), [sk.key]: n },
                            }))
                          }
                          className={cn(
                            "h-8 w-8 rounded-md border text-xs font-semibold transition",
                            v === n
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-background hover:border-primary/50",
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-lg border bg-card p-4">
        <label className="mb-2 block text-sm font-semibold text-primary">
          Player of the Day
        </label>
        <select
          value={potdId ?? ""}
          onChange={(e) => setPotdId(e.target.value || null)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— None —</option>
          {(presentPlayers as any[]).map((p) => (
            <option key={p.id} value={p.id}>
              {p.player_name}
            </option>
          ))}
        </select>
      </div>

      <Button className="w-full" disabled={submit.isPending} onClick={() => handleSubmit()}>
        {submit.isPending ? "Saving…" : "Save ratings"}
      </Button>
      {confirmDialog}
    </div>
  );
}
