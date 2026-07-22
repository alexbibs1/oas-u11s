import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  listMatchWeeks,
  getMyGroupsForWeek,
  getGroupRosterForWeek,
  upsertWeekRatings,
} from "@/lib/skill-ratings/skill-ratings.functions";
import { SKILLS, SKILL_DESCRIPTORS } from "@/lib/skills";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { qk } from "@/lib/query-keys";

export const Route = createFileRoute("/_authenticated/ratings")({
  component: RatingsPage,
});

function RatingsPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-3">
        {(sessionId || groupId) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (groupId) setGroupId(null);
              else setSessionId(null);
            }}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Weekly ratings
          </p>
          <h1 className="mt-1 text-2xl font-bold text-primary">
            {!sessionId && "Pick a week"}
            {sessionId && !groupId && "Pick a group"}
            {sessionId && groupId && "Score players"}
          </h1>
        </div>
      </header>

      {!sessionId && <WeekPicker onPick={setSessionId} />}
      {sessionId && !groupId && <GroupPicker sessionId={sessionId} onPick={setGroupId} />}
      {sessionId && groupId && (
        <RatingsEntry
          sessionId={sessionId}
          groupId={groupId}
          onDone={() => {
            setGroupId(null);
          }}
        />
      )}
    </main>
  );
}

function WeekPicker({ onPick }: { onPick: (id: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: qk.sessions.matchWeeks,
    queryFn: () => listMatchWeeks(),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data?.block)
    return (
      <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        No active block.
      </p>
    );
  if (!data.weeks.length)
    return (
      <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        No match weeks scheduled for {(data.block as any).name}.
      </p>
    );
  return (
    <ul className="space-y-2">
      {data.weeks.map((w: any) => (
        <li key={w.id}>
          <button
            onClick={() => onPick(w.id)}
            className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left hover:border-primary"
          >
            <div>
              <p className="text-sm font-semibold">
                Week {w.week_number ?? "—"} · {w.session_date}
              </p>
              <p className="text-xs text-muted-foreground">
                {w.opponent ? `vs ${w.opponent}` : "Match"}
                {w.venue ? ` · ${w.venue}` : ""}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">Open →</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function GroupPicker({ sessionId, onPick }: { sessionId: string; onPick: (id: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: qk.groups.myForWeek(sessionId),
    queryFn: () => getMyGroupsForWeek({ data: { session_id: sessionId } }),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data?.groups.length)
    return (
      <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        You're not assigned to a group for this week.
      </p>
    );
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {data.groups.map((g: any) => (
        <li key={g.id}>
          <button
            onClick={() => onPick(g.id)}
            className="flex w-full flex-col items-start gap-1 rounded-lg border bg-card p-4 text-left hover:border-primary"
          >
            <p className="text-base font-bold text-primary">Group {g.group_number}</p>
            <p className="text-xs text-muted-foreground">
              {g.coaches.length ? g.coaches.map((c: any) => c.name).join(", ") : "—"}
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
  groupId,
  onDone,
}: {
  sessionId: string;
  groupId: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: qk.groups.rosterForWeek(sessionId, groupId),
    queryFn: () => getGroupRosterForWeek({ data: { session_id: sessionId, group_id: groupId } }),
  });
  const [scores, setScores] = useState<Scores>({});
  const [potdId, setPotdId] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const init: Scores = {};
    const existingMap = new Map((data.existing as any[]).map((e) => [e.player_id, e]));
    for (const p of data.players as any[]) {
      const ex = existingMap.get(p.id);
      init[p.id] = {};
      for (const s of SKILLS) {
        init[p.id][s.key] = ex ? (ex as any)[s.key] : ((p as any)[s.key] ?? 3);
      }
    }
    setScores(init);
    const existingPotd = (data.existing as any[]).find((e) => e.player_of_the_day);
    setPotdId(existingPotd?.player_id ?? null);
  }, [data]);

  const submit = useMutation({
    mutationFn: () =>
      upsertWeekRatings({
        data: {
          session_id: sessionId,
          group_id: groupId,
          ratings: (data?.players ?? []).map((p: any) => ({
            player_id: p.id,
            carrying: scores[p.id]?.carrying ?? 3,
            handling: scores[p.id]?.handling ?? 3,
            tackling: scores[p.id]?.tackling ?? 3,
            rucking: scores[p.id]?.rucking ?? 3,
            kicking: scores[p.id]?.kicking ?? 3,
            catching: scores[p.id]?.catching ?? 3,
            iq: scores[p.id]?.iq ?? 3,
          })),
          player_of_the_day_id: potdId,
        },
      }),
    onSuccess: (r: any) => {
      toast.success(`Saved — ${r.inserted} new, ${r.updated} updated`);
      qc.invalidateQueries({ queryKey: qk.groups.rosterForWeek(sessionId, groupId) });
      qc.invalidateQueries({ queryKey: qk.sessions.weekCompletion.all });
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data.players.length)
    return (
      <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        No players to rate (everyone absent or moved out).
      </p>
    );

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {(data.players as any[]).map((p) => (
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
          {(data.players as any[]).map((p) => (
            <option key={p.id} value={p.id}>
              {p.player_name}
            </option>
          ))}
        </select>
      </div>

      <Button className="w-full" disabled={submit.isPending} onClick={() => submit.mutate()}>
        {submit.isPending ? "Saving…" : "Save ratings"}
      </Button>
    </div>
  );
}
