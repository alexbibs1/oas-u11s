import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyRole } from "@/lib/auth/roles.functions";
import { listMatchSessions } from "@/lib/sessions/sessions.functions";
import { getMatchTeamBuilderData, saveMatchTeams } from "@/lib/match/match.functions";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { GROUPINGS } from "@/lib/groupings";
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
        <p className="mt-1 text-sm text-muted-foreground">Pick up to 5 teams for a fixture.</p>
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

function TeamBuilder({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data, isLoading } = useQuery({
    queryKey: qk.match.builderData(sessionId),
    queryFn: () => getMatchTeamBuilderData({ data: { session_id: sessionId } }),
  });

  const [teams, setTeams] = useState<Record<number, TeamState>>({});
  const [activeTeam, setActiveTeam] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState<"all" | "unassigned">("all");
  const [search, setSearch] = useState("");
  const [editingCoaches, setEditingCoaches] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;
    const init: Record<number, TeamState> = {};
    for (const t of data.teams as any[]) {
      init[t.team_number] = { coach_ids: t.coach_ids, player_ids: t.player_ids };
    }
    setTeams(init);
    setDirty(false);
    const nums = Object.keys(init)
      .map(Number)
      .sort((a, b) => a - b);
    setActiveTeam((cur) => (cur && init[cur] ? cur : (nums[0] ?? null)));
  }, [data]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const teamNumbers = Object.keys(teams)
    .map(Number)
    .sort((a, b) => a - b);

  const update = (fn: (prev: Record<number, TeamState>) => Record<number, TeamState>) => {
    setTeams(fn);
    setDirty(true);
  };

  const addTeam = () => {
    for (let n = 1; n <= 5; n++) {
      if (!teams[n]) {
        update((prev) => ({ ...prev, [n]: { coach_ids: [], player_ids: [] } }));
        setActiveTeam(n);
        return;
      }
    }
  };

  const removeTeam = async (n: number) => {
    if (teams[n].player_ids.length) {
      const ok = await confirm({
        title: `Remove Team ${n}?`,
        description: `Its ${teams[n].player_ids.length} players go back to unassigned.`,
        confirmLabel: "Remove",
        destructive: true,
      });
      if (!ok) return;
    }
    update((prev) => {
      const next = { ...prev };
      delete next[n];
      return next;
    });
    if (activeTeam === n) setActiveTeam(teamNumbers.find((x) => x !== n) ?? null);
  };

  /** Tap a player: put them on the active team, or take them off it if already there. */
  const tapPlayer = (playerId: string) => {
    if (activeTeam == null) {
      toast.info("Add a team first");
      return;
    }
    update((prev) => {
      const next: Record<number, TeamState> = {};
      const alreadyHere = prev[activeTeam]?.player_ids.includes(playerId);
      for (const key of Object.keys(prev)) {
        const num = Number(key);
        next[num] = {
          ...prev[num],
          player_ids: prev[num].player_ids.filter((id) => id !== playerId),
        };
      }
      if (!alreadyHere) {
        next[activeTeam] = {
          ...next[activeTeam],
          player_ids: [...next[activeTeam].player_ids, playerId],
        };
      }
      return next;
    });
  };

  const toggleCoach = (n: number, coachId: string) => {
    update((prev) => {
      const cur = prev[n] ?? { coach_ids: [], player_ids: [] };
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

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const players = data.players as any[];
  const coaches = data.coaches as any[];
  const coachName = new Map(coaches.map((c) => [c.id, c.coach_name as string]));
  const teamOf = new Map<string, number>();
  for (const n of teamNumbers) for (const pid of teams[n].player_ids) teamOf.set(pid, n);
  const unassignedCount = players.filter((p) => !teamOf.has(p.id)).length;

  const groupingCount = (n: number, g: string) =>
    teams[n].player_ids.filter((pid) => {
      const p = players.find((x) => x.id === pid);
      return (p?.player_grouping ?? NO_GROUPING) === g;
    }).length;

  const q = search.trim().toLowerCase();
  const visible = players.filter(
    (p) =>
      (filter === "all" || !teamOf.has(p.id)) &&
      (!q || String(p.player_name).toLowerCase().includes(q)),
  );
  const sections = [
    ...GROUPINGS.map((g) => ({ key: g.value as string, label: `${g.value} · ${g.note}` })),
    { key: NO_GROUPING, label: "No grouping" },
  ]
    .map((sec) => ({
      ...sec,
      players: visible.filter((p) => (p.player_grouping ?? NO_GROUPING) === sec.key),
    }))
    .filter((sec) => sec.players.length > 0);

  const teamLabel = (n: number) => {
    const names = teams[n].coach_ids.map((id) => coachName.get(id)).filter(Boolean);
    return names.length ? names.join(" / ") : "No coaches";
  };

  return (
    <>
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

      {/* Teams: tap one to make it the active team */}
      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Teams · tap one, then tap players
          </h2>
          {teamNumbers.length < 5 && (
            <button
              onClick={addTeam}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Add team
            </button>
          )}
        </div>
        {teamNumbers.length === 0 ? (
          <button
            onClick={addTeam}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" /> Add the first team
          </button>
        ) : (
          <div className="space-y-2">
            {teamNumbers.map((n) => {
              const active = activeTeam === n;
              return (
                <div
                  key={n}
                  className={cn(
                    "rounded-lg border bg-card transition",
                    active ? "border-primary ring-2 ring-primary/30" : "",
                  )}
                >
                  <button
                    onClick={() => setActiveTeam(n)}
                    className="flex w-full items-center justify-between gap-2 px-3 pt-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-primary">
                        Team {n}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {teams[n].player_ids.length} players
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{teamLabel(n)}</p>
                    </div>
                    {active && (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                        Picking
                      </span>
                    )}
                  </button>
                  {/* Grouping balance strip */}
                  <div className="grid grid-cols-7 gap-1 px-3 pt-2">
                    {GROUPINGS.map((g) => {
                      const c = groupingCount(n, g.value);
                      return (
                        <div
                          key={g.value}
                          className={cn(
                            "rounded py-1 text-center text-[10px] tabular-nums",
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
                  <div className="flex items-center justify-between px-3 py-2">
                    <button
                      onClick={() => setEditingCoaches(editingCoaches === n ? null : n)}
                      className="text-xs font-medium text-primary"
                    >
                      {editingCoaches === n ? "Done" : "Coaches"}
                    </button>
                    <button
                      onClick={() => removeTeam(n)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remove team
                    </button>
                  </div>
                  {editingCoaches === n && (
                    <div className="flex flex-wrap gap-1 border-t px-3 py-2">
                      {coaches.map((c) => {
                        const on = teams[n].coach_ids.includes(c.id);
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
                            {c.coach_name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Squad */}
      <section className="pb-24">
        <div className="sticky top-0 z-10 -mx-5 mb-2 space-y-2 bg-background/95 px-5 py-2 backdrop-blur">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-1.5">
            {(
              [
                ["all", `All ${players.length}`],
                ["unassigned", `Not on a team ${unassignedCount}`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs tabular-nums",
                  filter === k
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {sections.length === 0 && (
          <p className="text-sm text-muted-foreground">No players match.</p>
        )}
        {sections.map((sec) => (
          <div key={sec.key} className="mb-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {sec.label}
            </p>
            <ul className="space-y-1">
              {sec.players.map((p) => {
                const on = teamOf.get(p.id);
                const onActive = on != null && on === activeTeam;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => tapPlayer(p.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left transition",
                        onActive
                          ? "border-primary bg-primary/10"
                          : on != null
                            ? "bg-muted/40 text-muted-foreground"
                            : "bg-card hover:border-primary/50",
                      )}
                    >
                      <span className="truncate text-sm font-medium">{p.player_name}</span>
                      {on != null ? (
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-0.5 text-xs font-bold",
                            onActive
                              ? "bg-primary text-primary-foreground"
                              : "border bg-background text-muted-foreground",
                          )}
                        >
                          Team {on}
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {activeTeam != null ? `+ Team ${activeTeam}` : ""}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {/* Sticky save bar above the bottom nav */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-2.5">
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
    </>
  );
}
