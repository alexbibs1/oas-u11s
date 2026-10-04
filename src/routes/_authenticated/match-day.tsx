import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { listMatchSessions } from "@/lib/sessions/sessions.functions";
import {
  getMatchDayContext,
  getMatchTeamsForSession,
  saveRegister,
  submitRatings,
} from "@/lib/match/match.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChevronLeft, X, ArrowRightLeft } from "lucide-react";
import { formatDateLong } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/match-day")({
  validateSearch: (s: Record<string, unknown>) => ({
    sessionId: typeof s.sessionId === "string" ? s.sessionId : undefined,
    teamId: typeof s.teamId === "string" ? s.teamId : undefined,
    step: s.step === "register" ? ("register" as const) : undefined,
  }),
  component: MatchDayPage,
});

type Step = "session" | "team" | "register" | "rate" | "done";

import { SKILLS, SKILL_DESCRIPTORS as DESCRIPTORS } from "@/lib/skills";
import { qk } from "@/lib/query-keys";
import { useConfirm } from "@/components/confirm-dialog";
import { QueryError } from "@/components/query-error";

function MatchDayPage() {
  const {
    sessionId: preselectId,
    teamId: preselectTeamId,
    step: preselectStep,
  } = Route.useSearch();
  const router = useRouter();
  const [step, setStep] = useState<Step>("session");
  const [session, setSession] = useState<any | null>(null);
  const [team, setTeam] = useState<any | null>(null);
  // When true, stay on the register even if it's already been confirmed.
  const [editRegister, setEditRegister] = useState(preselectStep === "register");

  const { data: preselectSessions } = useQuery({
    queryKey: qk.sessions.matchList,
    queryFn: () => listMatchSessions(),
    enabled: !!preselectId,
  });

  const { data: preselectTeams } = useQuery({
    queryKey: preselectId ? qk.match.teamsForSession(preselectId) : ["match-teams", "none"],
    queryFn: () => getMatchTeamsForSession({ data: { session_id: preselectId! } }),
    enabled: !!preselectId && !!preselectTeamId,
  });

  const [autoAdvanced, setAutoAdvanced] = useState(false);

  useEffect(() => {
    if (preselectId && !session && preselectSessions?.length) {
      const found = preselectSessions.find((s: any) => s.id === preselectId);
      if (found) {
        setSession(found);
        if (!preselectTeamId) setStep("team");
      }
    }
  }, [preselectId, preselectSessions, session, preselectTeamId]);

  useEffect(() => {
    if (preselectTeamId && !autoAdvanced && session && preselectTeams?.length) {
      const t = preselectTeams.find((x: any) => x.id === preselectTeamId);
      if (t) {
        setTeam({ id: t.id, team_number: t.team_number });
        setStep("register");
        setAutoAdvanced(true);
      }
    }
  }, [preselectTeamId, autoAdvanced, session, preselectTeams]);

  const back = () => {
    if (step === "session") {
      if (window.history.length > 1) router.history.back();
      else router.navigate({ to: "/calendar" });
      return;
    }
    if (step === "team") {
      setStep("session");
      setTeam(null);
    } else if (step === "register" || step === "rate") {
      if (preselectTeamId) {
        if (window.history.length > 1) router.history.back();
        else router.navigate({ to: "/home" });
        return;
      }
      setStep("team");
    } else if (step === "done") {
      setStep("session");
      setSession(null);
      setTeam(null);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8">
      <header className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Back">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Match Day</p>
          <h1 className="mt-1 text-2xl font-bold text-primary">
            {step === "session" && "Select match"}
            {step === "team" && "Select team"}
            {step === "register" && "Register"}
            {step === "rate" && "Rate players"}
            {step === "done" && "Submitted"}
          </h1>
          {session && step !== "session" && (
            <p className="text-xs text-muted-foreground">
              {formatDateLong(session.session_date)}
              {session.opponent ? ` • vs ${session.opponent}` : ""}
              {team ? ` • Team ${team.team_number}` : ""}
            </p>
          )}
        </div>
      </header>

      {step === "session" && (
        <SessionStep
          onPick={(s) => {
            setSession(s);
            if (!preselectTeamId) setStep("team");
          }}
        />
      )}
      {step === "team" && session && (
        <TeamStep
          sessionId={session.id}
          onPick={(t) => {
            setTeam(t);
            setEditRegister(false);
            setStep("register");
          }}
        />
      )}
      {step === "register" && session && team && (
        <RegisterStep
          session={session}
          team={team}
          skipIfConfirmed={!editRegister}
          onProceed={() => {
            setEditRegister(false);
            setStep("rate");
          }}
        />
      )}
      {step === "rate" && session && team && (
        <RateStep
          session={session}
          team={team}
          onDone={() => setStep("done")}
          onEditRegister={() => {
            setEditRegister(true);
            setStep("register");
          }}
        />
      )}
      {step === "done" && session && (
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-lg font-semibold text-primary">Ratings submitted</p>
          <p className="mt-2 text-sm text-muted-foreground">Ratings saved for this match.</p>
          <div className="mt-6 flex flex-col gap-3">
            <Button asChild>
              <Link to="/match-summary/$sessionId" params={{ sessionId: session.id }}>
                View match summary
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/home">Back to home</Link>
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function SessionStep({ onPick }: { onPick: (s: any) => void }) {
  const {
    data: sessions = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: qk.sessions.matchList,
    queryFn: () => listMatchSessions(),
  });
  if (isError) return <QueryError onRetry={() => refetch()} />;
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!sessions.length)
    return (
      <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        No matches yet. An admin can add one from the Calendar.
      </p>
    );
  return (
    <ul className="space-y-2">
      {sessions.map((s: any) => (
        <li key={s.id}>
          <button
            onClick={() => onPick(s)}
            className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition hover:border-primary"
          >
            <div>
              <p className="text-sm font-semibold">{formatDateLong(s.session_date)}</p>
              <p className="text-xs text-muted-foreground">
                {s.opponent ? `vs ${s.opponent}` : "Match"}
                {s.venue ? `, ${s.venue}` : ""}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function TeamStep({ sessionId, onPick }: { sessionId: string; onPick: (t: any) => void }) {
  const {
    data: teams = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: qk.match.teamsForSession(sessionId),
    queryFn: () => getMatchTeamsForSession({ data: { session_id: sessionId } }),
  });
  if (isError) return <QueryError onRetry={() => refetch()} />;
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!teams.length)
    return (
      <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        No teams picked for this match yet. An admin needs to pick teams from the Admin page first.
      </p>
    );
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {teams.map((t: any) => (
        <li key={t.id}>
          <button
            onClick={() => onPick(t)}
            className="flex w-full flex-col items-start gap-1 rounded-lg border bg-card p-4 text-left transition hover:border-primary"
          >
            <p className="text-base font-bold text-primary">Team {t.team_number}</p>
            <p className="text-xs text-muted-foreground">
              {t.coaches.length ? t.coaches.join(", ") : "No coaches assigned"}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}

type RegStatus = "present" | "absent" | "move";

function RegisterStep({
  session,
  team,
  onProceed,
  skipIfConfirmed,
}: {
  session: any;
  team: any;
  onProceed: () => void;
  skipIfConfirmed: boolean;
}) {
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const {
    data: ctx,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: qk.match.context(session.id, team.id),
    queryFn: () => getMatchDayContext({ data: { session_id: session.id, team_id: team.id } }),
    staleTime: 0,
  });
  const { data: allTeams = [] } = useQuery({
    queryKey: qk.match.teamsForSession(session.id),
    queryFn: () => getMatchTeamsForSession({ data: { session_id: session.id } }),
  });

  const [state, setState] = useState<Record<string, { status: RegStatus; move_to?: string }>>({});

  useEffect(() => {
    if (!ctx) return;
    const init: Record<string, { status: RegStatus; move_to?: string }> = {};
    for (const p of ctx.defaultRoster as any[]) {
      const ov = (ctx.overrides as any[]).find((o) => o.player_id === p.id);
      if (!ov) {
        init[p.id] = { status: "present" };
      } else if (ov.override_team_id === null) {
        init[p.id] = { status: "absent" };
      } else if (ov.override_team_id === team.id) {
        init[p.id] = { status: "present" };
      } else {
        init[p.id] = { status: "move", move_to: ov.override_team_id };
      }
    }
    for (const p of ctx.movedInPlayers as any[]) {
      if (!init[p.id]) init[p.id] = { status: "present" };
    }
    setState(init);
  }, [ctx, team.id]);

  // Register already confirmed: go straight to scoring (coach can come back via "Edit register").
  useEffect(() => {
    if (ctx?.registered && skipIfConfirmed) onProceed();
  }, [ctx?.registered, skipIfConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    const ok = await confirm({
      title: "Confirm register?",
      description:
        "This will save the attendance register for this team. You can still amend it later by coming back to Match Day.",
      confirmLabel: "Confirm",
    });
    if (!ok) return;
    save.mutate();
  };

  const save = useMutation({
    mutationFn: () =>
      saveRegister({
        data: {
          session_id: session.id,
          team_id: team.id,
          entries: Object.entries(state).map(([player_id, v]) => ({
            player_id,
            status: v.status,
            move_to_team_id: v.status === "move" ? (v.move_to ?? null) : null,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Register confirmed");
      qc.invalidateQueries({ queryKey: qk.match.context(session.id, team.id) });
      onProceed();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isError) return <QueryError onRetry={() => refetch()} />;
  if (isLoading || !ctx) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const otherTeams = (allTeams as any[]).filter((t) => t.id !== team.id);
  if (ctx.registered && skipIfConfirmed) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-3">
      {(() => {
        const renderRow = (p: any) => {
          const s = state[p.id] ?? { status: "present" as RegStatus };
          return (
            <li key={p.id} className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{p.player_name}</span>
                <div className="flex gap-1">
                  <PillBtn
                    active={s.status === "absent"}
                    color="grey"
                    onClick={() =>
                      setState({
                        ...state,
                        [p.id]:
                          s.status === "absent" ? { status: "present" } : { status: "absent" },
                      })
                    }
                  >
                    <X className="h-3.5 w-3.5" /> Absent
                  </PillBtn>
                  <PillBtn
                    active={s.status === "move"}
                    color="amber"
                    disabled={otherTeams.length === 0}
                    onClick={() =>
                      setState({
                        ...state,
                        [p.id]:
                          s.status === "move"
                            ? { status: "present" }
                            : { status: "move", move_to: otherTeams[0]?.id },
                      })
                    }
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" /> Move
                  </PillBtn>
                  {otherTeams.length === 0 && (
                    <span className="text-xs text-muted-foreground">No other teams</span>
                  )}
                </div>
              </div>
              {s.status === "move" && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {otherTeams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() =>
                        setState({ ...state, [p.id]: { status: "move", move_to: t.id } })
                      }
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs",
                        s.move_to === t.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background",
                      )}
                    >
                      Team {t.team_number}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        };
        return (
          <>
            <ul className="space-y-2">{(ctx.defaultRoster as any[]).map(renderRow)}</ul>
            {(ctx.movedInPlayers as any[]).length > 0 && (
              <>
                <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Moved in from other teams
                </p>
                <ul className="space-y-2">{(ctx.movedInPlayers as any[]).map(renderRow)}</ul>
              </>
            )}
          </>
        );
      })()}

      <Button className="w-full" disabled={save.isPending} onClick={() => handleSave()}>
        {save.isPending ? "Saving…" : "Confirm Register"}
      </Button>
      {confirmDialog}
    </div>
  );
}

function PillBtn({
  active,
  color,
  children,
  onClick,
  disabled,
}: {
  active: boolean;
  color: "green" | "grey" | "amber";
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  const palette = {
    green: active
      ? "bg-emerald-600 text-white border-emerald-600"
      : "border-emerald-600/40 text-emerald-700",
    grey: active
      ? "bg-slate-500 text-white border-slate-500"
      : "border-slate-400/50 text-slate-600",
    amber: active
      ? "bg-amber-500 text-white border-amber-500"
      : "border-amber-500/50 text-amber-700",
  }[color];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-60",
        palette,
      )}
    >
      {children}
    </button>
  );
}

function RateStep({
  session,
  team,
  onDone,
  onEditRegister,
}: {
  session: any;
  team: any;
  onDone: () => void;
  onEditRegister: () => void;
}) {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const {
    data: ctx,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: qk.match.context(session.id, team.id),
    queryFn: () => getMatchDayContext({ data: { session_id: session.id, team_id: team.id } }),
    staleTime: 0,
  });

  const presentPlayers = useMemo(() => (ctx ? (ctx.playing as any[]) : ([] as any[])), [ctx]);

  const [scores, setScores] = useState<Record<string, any>>({});
  const [activeDescriptor, setActiveDescriptor] = useState<string | null>(null);
  const [potdId, setPotdId] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx) return;
    const init: Record<string, any> = {};
    const existingByPid = new Map((ctx.ratings as any[]).map((r) => [r.player_id, r]));
    for (const p of presentPlayers) {
      const ex = existingByPid.get(p.id);
      const entry: any = {};
      for (const s of SKILLS) {
        entry[s.key] = ex?.[s.key] ?? p[s.key] ?? 3;
      }
      init[p.id] = entry;
    }
    setScores(init);
    const existingPotd = (ctx.ratings as any[]).find((r) => r.player_of_the_day);
    setPotdId(existingPotd?.player_id ?? null);
  }, [ctx, presentPlayers]);

  const hasExisting = (ctx?.ratings as any[] | undefined)?.length ?? 0;

  const submit = useMutation({
    mutationFn: () =>
      submitRatings({
        data: {
          session_id: session.id,
          team_id: team.id,
          ratings: presentPlayers.map((p) => ({
            player_id: p.id,
            ...scores[p.id],
          })),
          player_of_the_day_id: potdId,
        },
      }),
    onSuccess: () => {
      toast.success("Ratings saved");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

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

  if (isError) return <QueryError onRetry={() => refetch()} />;
  if (isLoading || !ctx) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const editBar = (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5">
      <p className="text-xs text-muted-foreground">
        Register confirmed · {presentPlayers.length} playing
      </p>
      <Button variant="outline" size="sm" onClick={onEditRegister}>
        Edit register
      </Button>
    </div>
  );
  if (!presentPlayers.length)
    return (
      <div className="space-y-3">
        {editBar}
        <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          No players marked present.
        </p>
      </div>
    );

  return (
    <div className="space-y-3">
      {editBar}
      <ul className="space-y-3">
        {presentPlayers.map((p) => (
          <li key={p.id} className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-base font-bold text-primary">{p.player_name}</p>
            <div className="space-y-2">
              {SKILLS.map((sk) => (
                <div key={sk.key} className="flex items-center justify-between gap-2">
                  <span className="w-20 text-xs font-medium text-muted-foreground">{sk.label}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const val = scores[p.id]?.[sk.key];
                      const active = val === n;
                      const id = `${p.id}|${sk.key}|${n}`;
                      return (
                        <button
                          key={n}
                          onClick={() => {
                            setScores({
                              ...scores,
                              [p.id]: { ...scores[p.id], [sk.key]: n },
                            });
                            setActiveDescriptor(id);
                            setTimeout(
                              () => setActiveDescriptor((cur) => (cur === id ? null : cur)),
                              1800,
                            );
                          }}
                          className={cn(
                            "h-8 w-8 rounded-md border text-sm font-semibold transition",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-background hover:border-primary/50",
                          )}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {activeDescriptor?.startsWith(`${p.id}|`) && (
                <p className="pt-1 text-right text-xs italic text-accent">
                  {DESCRIPTORS[Number(activeDescriptor.split("|").pop())]}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="rounded-lg border bg-card p-4">
        <label className="mb-2 block text-sm font-semibold text-primary">Player of the Day</label>
        <select
          value={potdId ?? ""}
          onChange={(e) => setPotdId(e.target.value || null)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— None —</option>
          {presentPlayers.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.player_name}
            </option>
          ))}
        </select>
      </div>
      <Button className="w-full" onClick={handleSubmit} disabled={submit.isPending}>
        {submit.isPending ? "Saving…" : "Submit Ratings"}
      </Button>
      {confirmDialog}
    </div>
  );
}
