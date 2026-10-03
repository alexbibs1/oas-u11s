import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyRole } from "@/lib/auth/roles.functions";
import { listMatchSessions } from "@/lib/sessions/sessions.functions";
import { getMatchTeamBuilderData, saveMatchTeams } from "@/lib/match/match.functions";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { GroupingBadge } from "@/components/grouping-badge";
import { useConfirm } from "@/components/confirm-dialog";
import { QueryError } from "@/components/query-error";
import { GROUPINGS, groupingInfo } from "@/lib/groupings";
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

function MatchTeamsPage() {
  const { sessionId } = Route.useSearch();
  const [selected, setSelected] = useState<string | null>(sessionId ?? null);

  return (
    <main className="mx-auto max-w-6xl px-5 pt-8 pb-32">
      {!selected ? (
        <MatchList onPick={setSelected} />
      ) : (
        <TeamBuilder sessionId={selected} onBack={() => setSelected(null)} />
      )}
    </main>
  );
}

function MatchList({ onPick }: { onPick: (id: string) => void }) {
  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: qk.sessions.matchList,
    queryFn: () => listMatchSessions(),
  });
  if (isError) return <QueryError onRetry={() => refetch()} />;

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Team Picker</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose a match to pick its teams.</p>
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

const NO_GROUPING = "none";
const POOL = "pool";
const MAX_TEAMS = 5;

export function TeamBuilder({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk.match.builderData(sessionId),
    queryFn: () => getMatchTeamBuilderData({ data: { session_id: sessionId } }),
  });
  // Teams with a register, scores or moved players can't be removed.
  const lockedUpTo = Math.max(
    0,
    ...((data?.teams as any[] | undefined) ?? []).filter((t) => t.locked).map((t) => t.team_number),
  );

  const [teamCount, setTeamCount] = useState(0);
  const [teams, setTeams] = useState<Record<number, TeamState>>({});
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editingCoaches, setEditingCoaches] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  useEffect(() => {
    if (!data) return;
    const init: Record<number, TeamState> = {};
    let max = 0;
    for (const t of data.teams as any[]) {
      init[t.team_number] = { coach_ids: t.coach_ids, player_ids: t.player_ids };
      max = Math.max(max, t.team_number);
    }
    for (let n = 1; n <= max; n++) init[n] ??= { coach_ids: [], player_ids: [] };
    setTeams(init);
    setTeamCount(max);
    setDirty(false);
  }, [data]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const teamNumbers = Array.from({ length: teamCount }, (_, i) => i + 1);
  const lockedTeams = new Set<number>(
    ((data?.teams as any[] | undefined) ?? []).filter((t) => t.locked).map((t) => t.team_number),
  );

  const changeTeamCount = async (n: number) => {
    if (n === teamCount) return;
    if (n < lockedUpTo) {
      toast.error(`Team ${lockedUpTo} already has a register or scores, so it can't be removed`);
      return;
    }
    if (n < teamCount) {
      const losing = teamNumbers
        .filter((t) => t > n)
        .reduce((acc, t) => acc + (teams[t]?.player_ids.length ?? 0), 0);
      if (losing) {
        const ok = await confirm({
          title: `Go down to ${n} team${n === 1 ? "" : "s"}?`,
          description: `${losing} player${losing === 1 ? "" : "s"} in the removed team${teamCount - n === 1 ? "" : "s"} go back to the squad.`,
          confirmLabel: "Continue",
        });
        if (!ok) return;
      }
    }
    setTeams((prev) => {
      const next: Record<number, TeamState> = {};
      for (let t = 1; t <= n; t++) next[t] = prev[t] ?? { coach_ids: [], player_ids: [] };
      return next;
    });
    setTeamCount(n);
    setDirty(true);
  };

  /** Move a player to a team (1..n) or back to the squad (null). */
  const movePlayer = (playerId: string, target: number | null) => {
    setTeams((prev) => {
      const next: Record<number, TeamState> = {};
      for (const key of Object.keys(prev)) {
        const num = Number(key);
        next[num] = {
          ...prev[num],
          player_ids: prev[num].player_ids.filter((id) => id !== playerId),
        };
      }
      if (target != null && next[target]) {
        next[target] = { ...next[target], player_ids: [...next[target].player_ids, playerId] };
      }
      return next;
    });
    setDirty(true);
    setSelected(null);
  };

  const toggleCoach = (n: number, coachId: string) => {
    setTeams((prev) => {
      const cur = prev[n];
      const has = cur.coach_ids.includes(coachId);
      return {
        ...prev,
        [n]: {
          ...cur,
          coach_ids: has
            ? cur.coach_ids.filter((id) => id !== coachId)
            : [...cur.coach_ids, coachId],
        },
      };
    });
    setDirty(true);
  };

  const onDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    const pid = String(e.active.id);
    const over = e.over?.id;
    if (over == null) return;
    movePlayer(pid, over === POOL ? null : Number(String(over).replace("team-", "")));
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
      setDirty(false);
      qc.invalidateQueries({ queryKey: qk.match.builderData(sessionId) });
      qc.invalidateQueries({ queryKey: qk.match.teamsForSession(sessionId) });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleBack = async () => {
    if (dirty) {
      const ok = await confirm({
        title: "Leave without saving?",
        description: "Your team changes will be lost.",
        confirmLabel: "Leave",
        destructive: true,
      });
      if (!ok) return;
    }
    onBack();
  };

  // Never show an editable picker if loading failed: saving it would wipe the real teams.
  if (isError) return <QueryError onRetry={() => refetch()} />;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const players = data.players as any[];
  const byId = new Map(players.map((p) => [p.id as string, p]));
  const coaches = data.coaches as any[];
  const coachName = new Map(coaches.map((c) => [c.id, c.coach_name as string]));
  const teamOf = new Map<string, number>();
  for (const n of teamNumbers) for (const pid of teams[n]?.player_ids ?? []) teamOf.set(pid, n);

  const q = search.trim().toLowerCase();
  const pool = players.filter(
    (p) => !teamOf.has(p.id) && (!q || String(p.player_name).toLowerCase().includes(q)),
  );
  const poolSections = [
    ...GROUPINGS.map((g) => ({ key: g.value as string, label: `${g.value} · ${g.note}` })),
    { key: NO_GROUPING, label: "No grouping" },
  ]
    .map((sec) => ({
      ...sec,
      players: pool.filter((p) => (p.player_grouping ?? NO_GROUPING) === sec.key),
    }))
    .filter((sec) => sec.players.length > 0);

  const rank = (pid: string) => {
    const g = byId.get(pid)?.player_grouping;
    const i = GROUPINGS.findIndex((x) => x.value === g);
    return i === -1 ? 99 : i;
  };

  const unassignedCount = players.filter((p) => !teamOf.has(p.id)).length;
  const draggingPlayer = draggingId ? byId.get(draggingId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <header className="mb-4">
        <button onClick={handleBack} className="text-xs text-muted-foreground hover:underline">
          <ChevronLeft className="inline h-3 w-3" /> Matches
        </button>
        <h1 className="mt-1 text-2xl font-bold text-primary">
          {formatDateLong(data.session.session_date)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {data.session.opponent ? `vs ${data.session.opponent}` : "Match"}
          {data.session.venue ? ` · ${data.session.venue}` : ""}
        </p>
      </header>

      {/* How many teams */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm font-semibold">Teams</span>
        <div className="flex gap-1">
          {Array.from({ length: MAX_TEAMS }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => changeTeamCount(n)}
              disabled={n < lockedUpTo}
              title={n < lockedUpTo ? `Team ${lockedUpTo} has a register or scores` : undefined}
              className={cn(
                "h-9 w-9 rounded-md border text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40",
                teamCount === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:border-primary/50",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {teamCount === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Choose how many teams you need.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Drag players into a team, or tap a player and choose a team.
          </p>
          <div className="grid gap-4 pb-24 lg:grid-cols-[minmax(260px,340px)_1fr]">
            {/* Squad pool */}
            <PoolDrop selected={selected} onTap={() => selected && movePlayer(selected, null)}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold text-primary">Squad · {unassignedCount} left</h2>
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search players"
                className="mb-3 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              {poolSections.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {q ? "No players match." : "Everyone is on a team."}
                </p>
              )}
              <div className="max-h-[60vh] overflow-y-auto pr-1 lg:max-h-[calc(100vh-260px)]">
                {poolSections.map((sec) => (
                  <div key={sec.key} className="mb-3">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {sec.label}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {sec.players.map((p) => (
                        <PlayerChip
                          key={p.id}
                          id={p.id}
                          name={p.player_name}
                          grouping={p.player_grouping}
                          selected={selected === p.id}
                          onTap={() => setSelected(selected === p.id ? null : p.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </PoolDrop>

            <div className="space-y-3">
              <BalanceTable
                teamNumbers={teamNumbers}
                teams={teams}
                groupOf={(pid) => groupingInfo(byId.get(pid)?.player_grouping)?.group ?? null}
                coachLabel={(n) =>
                  teams[n].coach_ids
                    .map((id) => coachName.get(id))
                    .filter(Boolean)
                    .join(" / ")
                }
              />
              {/* Team buckets */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {teamNumbers.map((n) => {
                  const t = teams[n];
                  const names = t.coach_ids.map((id) => coachName.get(id)).filter(Boolean);
                  const sorted = [...t.player_ids].sort((a, b) => rank(a) - rank(b));
                  return (
                    <TeamDrop
                      key={n}
                      n={n}
                      selected={selected}
                      onTap={() => selected && movePlayer(selected, n)}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-primary">
                            Team {n}{" "}
                            <span className="font-normal text-muted-foreground">
                              · {t.player_ids.length}
                            </span>
                            {lockedTeams.has(n) && (
                              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
                                Register in
                              </span>
                            )}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCoaches(editingCoaches === n ? null : n);
                            }}
                            className={cn(
                              "truncate text-left text-xs",
                              names.length ? "text-foreground" : "font-semibold text-amber-600",
                            )}
                          >
                            {names.length ? names.join(" / ") : "Add coaches"}{" "}
                            <span className="text-primary">
                              {editingCoaches === n ? "· done" : "· edit"}
                            </span>
                          </button>
                        </div>
                      </div>
                      {editingCoaches === n && (
                        <div
                          className="mb-2 flex flex-wrap gap-1 rounded-md border bg-background p-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {coaches.map((c) => {
                            const on = t.coach_ids.includes(c.id);
                            return (
                              <button
                                key={c.id}
                                onClick={() => toggleCoach(n, c.id)}
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                                  on
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "bg-background text-muted-foreground",
                                )}
                              >
                                {on ? "✓ " : ""}
                                {c.coach_name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* Grouping balance */}
                      <div className="mb-2 grid grid-cols-7 gap-0.5">
                        {GROUPINGS.map((g) => {
                          const c = t.player_ids.filter(
                            (pid) => byId.get(pid)?.player_grouping === g.value,
                          ).length;
                          return (
                            <div
                              key={g.value}
                              className={cn(
                                "rounded py-0.5 text-center text-[10px] leading-tight tabular-nums",
                                c
                                  ? "bg-secondary font-semibold text-foreground"
                                  : "bg-muted/50 text-muted-foreground/60",
                              )}
                            >
                              <div className="font-bold">{g.value}</div>
                              <div>{c}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex min-h-[3rem] flex-wrap content-start gap-1.5">
                        {sorted.length === 0 && (
                          <p className="w-full py-3 text-center text-xs text-muted-foreground">
                            Drop players here
                          </p>
                        )}
                        {sorted.map((pid) => {
                          const p = byId.get(pid);
                          if (!p) return null;
                          return (
                            <PlayerChip
                              key={pid}
                              id={pid}
                              name={p.player_name}
                              grouping={p.player_grouping}
                              selected={selected === pid}
                              onTap={() => setSelected(selected === pid ? null : pid)}
                              onRemove={() => movePlayer(pid, null)}
                            />
                          );
                        })}
                      </div>
                    </TeamDrop>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      <DragOverlay>
        {draggingPlayer ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary bg-card px-2.5 py-1 text-xs font-medium shadow-lg">
            {draggingPlayer.player_name}
            <GroupingBadge value={draggingPlayer.player_grouping} />
          </span>
        ) : null}
      </DragOverlay>

      {/* Sticky save bar above the bottom nav, with quick-move buttons when a player is selected */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t bg-card/95 backdrop-blur">
        {selected && byId.get(selected) && (
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1.5 border-b px-5 py-2">
            <span className="mr-1 text-xs font-semibold">
              Move {byId.get(selected).player_name} to
            </span>
            {teamNumbers.map((n) => (
              <button
                key={n}
                onClick={() => movePlayer(selected, n)}
                className={cn(
                  "h-8 min-w-8 rounded-md border px-2 text-xs font-bold",
                  teamOf.get(selected) === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background",
                )}
              >
                {n}
              </button>
            ))}
            {teamOf.has(selected) && (
              <button
                onClick={() => movePlayer(selected, null)}
                className="h-8 rounded-md border bg-background px-2 text-xs"
              >
                Squad
              </button>
            )}
            <button
              onClick={() => setSelected(null)}
              className="ml-auto text-xs text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-2.5">
          <p className="text-xs text-muted-foreground">
            {dirty ? (
              <span className="font-semibold text-amber-600">Unsaved changes</span>
            ) : (
              "All changes saved"
            )}
            {" · "}
            {unassignedCount} not on a team
          </p>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !dirty}>
            {save.isPending ? "Saving…" : "Save teams"}
          </Button>
        </div>
      </div>
      {confirmDialog}
    </DndContext>
  );
}

function PoolDrop({
  selected,
  onTap,
  children,
}: {
  selected: string | null;
  onTap: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL });
  return (
    <section
      ref={setNodeRef}
      onClick={onTap}
      className={cn(
        "self-start rounded-lg border bg-card p-3 transition lg:sticky lg:top-4",
        isOver && "border-primary ring-2 ring-primary/30",
        selected && "cursor-pointer",
      )}
    >
      {children}
    </section>
  );
}

function TeamDrop({
  n,
  selected,
  onTap,
  children,
}: {
  n: number;
  selected: string | null;
  onTap: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `team-${n}` });
  return (
    <div
      ref={setNodeRef}
      onClick={onTap}
      className={cn(
        "rounded-lg border bg-card p-3 transition",
        isOver && "border-primary bg-primary/5 ring-2 ring-primary/30",
        selected && "cursor-pointer border-dashed border-primary/60",
      )}
    >
      {children}
    </div>
  );
}

function PlayerChip({
  id,
  name,
  grouping,
  selected,
  onTap,
  onRemove,
}: {
  id: string;
  name: string;
  grouping: string | null;
  selected: boolean;
  onTap: () => void;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
      className={cn(
        "inline-flex touch-none select-none items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:border-primary/50",
        isDragging && "opacity-30",
      )}
    >
      {name}
      <GroupingBadge value={grouping} className={selected ? "text-foreground" : ""} />
      {onRemove && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${name}`}
          className="-mr-1 ml-0.5 rounded-full px-1 text-muted-foreground hover:text-destructive"
        >
          ×
        </button>
      )}
    </span>
  );
}

const BALANCE_GROUPS = ["Gp 1", "Gp 2", "Gp 3", "Gp 4"] as const;

/**
 * Each team's count per group vs its target (group total on teams / number of teams).
 * Green: within one of target. Orange: too many. Blue: too few.
 */
function BalanceTable({
  teamNumbers,
  teams,
  groupOf,
  coachLabel,
}: {
  teamNumbers: number[];
  teams: Record<number, TeamState>;
  groupOf: (playerId: string) => string | null;
  coachLabel: (n: number) => string;
}) {
  const placed = teamNumbers.reduce((acc, n) => acc + (teams[n]?.player_ids.length ?? 0), 0);
  if (teamNumbers.length < 2 || placed === 0) return null;

  const counts = new Map<number, Record<string, number>>();
  for (const n of teamNumbers) {
    const c: Record<string, number> = {};
    for (const g of BALANCE_GROUPS) c[g] = 0;
    for (const pid of teams[n]?.player_ids ?? []) {
      const g = groupOf(pid);
      if (g && g in c) c[g] += 1;
    }
    counts.set(n, c);
  }
  const fair: Record<string, number> = {};
  for (const g of BALANCE_GROUPS) {
    const total = teamNumbers.reduce((acc, n) => acc + counts.get(n)![g], 0);
    fair[g] = total / teamNumbers.length;
  }
  const status = (count: number, g: string) => {
    const diff = count - fair[g];
    return diff > 1 ? "over" : diff < -1 ? "under" : "ok";
  };

  const fairLabel = (v: number) => {
    const lo = Math.floor(v);
    const hi = Math.ceil(v);
    return lo === hi ? String(lo) : `${lo}-${hi}`;
  };
  const cell = {
    ok: "bg-emerald-100 text-emerald-900",
    over: "bg-orange-200 text-orange-950",
    under: "bg-sky-200 text-sky-950",
  } as const;

  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-primary">Balance</h2>
      </div>
      <table className="w-full table-fixed border-separate border-spacing-1 text-center text-xs tabular-nums">
        <thead>
          <tr className="text-muted-foreground">
            <th className="w-2/5 text-left font-medium" />
            {BALANCE_GROUPS.map((g) => (
              <th key={g} className="font-semibold">
                {g}
              </th>
            ))}
          </tr>
          <tr className="text-muted-foreground">
            <td className="text-left text-[11px]">Target per team</td>
            {BALANCE_GROUPS.map((g) => (
              <td key={g} className="text-[11px]">
                {fairLabel(fair[g])}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {teamNumbers.map((n) => (
            <tr key={n}>
              <td className="truncate text-left">
                <span className="font-semibold">Team {n}</span>
                {coachLabel(n) && <span className="text-muted-foreground"> · {coachLabel(n)}</span>}
              </td>
              {BALANCE_GROUPS.map((g) => {
                const c = counts.get(n)![g];
                return (
                  <td key={g} className={cn("rounded py-1.5 font-bold", cell[status(c, g)])}>
                    {c}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" /> About
          right
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-orange-200" /> Too many
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-200" /> Too few
        </span>
      </div>
    </section>
  );
}
