import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { listMatchSessions } from "@/lib/sessions/sessions.functions";
import {
  getMatchDayContext,
  listGroupsForBlock,
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
  }),
  component: MatchDayPage,
});

type Step = "session" | "group" | "register" | "rate" | "done";

import { SKILLS, SKILL_DESCRIPTORS as DESCRIPTORS } from "@/lib/skills";
import { qk } from "@/lib/query-keys";
import { useConfirm } from "@/components/confirm-dialog";

function MatchDayPage() {
  const { sessionId: preselectId } = Route.useSearch();
  const router = useRouter();
  const [step, setStep] = useState<Step>("session");
  const [session, setSession] = useState<any | null>(null);
  const [group, setGroup] = useState<any | null>(null);

  const { data: preselectSessions } = useQuery({
    queryKey: qk.sessions.matchList,
    queryFn: () => listMatchSessions(),
    enabled: !!preselectId,
  });

  useEffect(() => {
    if (preselectId && !session && preselectSessions?.length) {
      const found = preselectSessions.find((s: any) => s.id === preselectId);
      if (found && found.block_is_active) {
        setSession(found);
        setStep("group");
      }
    }
  }, [preselectId, preselectSessions, session]);

  const back = () => {
    if (step === "session") {
      if (window.history.length > 1) router.history.back();
      else router.navigate({ to: "/calendar" });
      return;
    }
    if (step === "group") {
      setStep("session");
      setGroup(null);
    } else if (step === "register" || step === "rate") {
      setStep("group");
    } else if (step === "done") {
      setStep("session");
      setSession(null);
      setGroup(null);
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
            {step === "session" && "Select session"}
            {step === "group" && "Select group"}
            {step === "register" && "Register"}
            {step === "rate" && "Rate players"}
            {step === "done" && "Submitted"}
          </h1>
          {session && step !== "session" && (
            <p className="text-xs text-muted-foreground">
              {session.block_name} • {formatDateLong(session.session_date)}
              {group ? ` • Group ${group.group_number}` : ""}
            </p>
          )}
        </div>
      </header>

      {step === "session" && (
        <SessionStep
          onPick={(s) => {
            setSession(s);
            setStep("group");
          }}
        />
      )}
      {step === "group" && session && (
        <GroupStep
          blockId={session.block_id}
          onPick={(g) => {
            setGroup(g);
            setStep("register");
          }}
        />
      )}
      {step === "register" && session && group && (
        <RegisterStep session={session} group={group} onProceed={() => setStep("rate")} />
      )}
      {step === "rate" && session && group && (
        <RateStep session={session} group={group} onDone={() => setStep("done")} />
      )}
      {step === "done" && (
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-lg font-semibold text-primary">Ratings submitted</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Baseline scores updated for the active block.
          </p>
          <Button className="mt-6" onClick={back}>
            Done
          </Button>
        </div>
      )}
    </main>
  );
}

function SessionStep({ onPick }: { onPick: (s: any) => void }) {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: qk.sessions.matchList,
    queryFn: () => listMatchSessions(),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!sessions.length)
    return (
      <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        No match sessions yet. A block builder can add one from the Admin page.
      </p>
    );
  return (
    <ul className="space-y-2">
      {sessions.map((s: any) => {
        const selectable = s.block_is_active;
        return (
          <li key={s.id}>
            <button
              disabled={!selectable}
              onClick={() => onPick(s)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition",
                selectable ? "hover:border-primary" : "opacity-50 cursor-not-allowed",
              )}
            >
              <div>
                <p className="text-sm font-semibold">{formatDateLong(s.session_date)}</p>
                <p className="text-xs text-muted-foreground">
                  {s.opponent ? `vs ${s.opponent}` : "Match"}
                  {s.venue ? `, ${s.venue}` : ""}
                </p>
              </div>
              {!selectable && <span className="text-xs text-muted-foreground">Closed</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function GroupStep({ blockId, onPick }: { blockId: string; onPick: (g: any) => void }) {
  const { data: groups = [], isLoading } = useQuery({
    queryKey: qk.groups.forBlock(blockId),
    queryFn: () => listGroupsForBlock({ data: { block_id: blockId } }),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!groups.length)
    return (
      <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        No groups configured for this block.
      </p>
    );
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {groups.map((g: any) => (
        <li key={g.id}>
          <button
            onClick={() => onPick(g)}
            className="flex w-full flex-col items-start gap-1 rounded-lg border bg-card p-4 text-left transition hover:border-primary"
          >
            <p className="text-base font-bold text-primary">Group {g.group_number}</p>
            <p className="text-xs text-muted-foreground">
              {g.coaches.length ? g.coaches.join(", ") : "No coaches assigned"}
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
  group,
  onProceed,
}: {
  session: any;
  group: any;
  onProceed: () => void;
}) {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: qk.me, queryFn: () => getMyRole() });
  const { data: ctx, isLoading } = useQuery({
    queryKey: qk.match.context(session.id, group.id),
    queryFn: () => getMatchDayContext({ data: { session_id: session.id, group_id: group.id } }),
    staleTime: 0,
  });
  const { data: allGroups = [] } = useQuery({
    queryKey: qk.groups.forBlock(session.block_id),
    queryFn: () => listGroupsForBlock({ data: { block_id: session.block_id } }),
  });

  const [state, setState] = useState<Record<string, { status: RegStatus; move_to?: string }>>({});

  useEffect(() => {
    if (!ctx) return;
    const init: Record<string, { status: RegStatus; move_to?: string }> = {};
    for (const p of ctx.defaultRoster as any[]) {
      const ov = (ctx.overrides as any[]).find((o) => o.player_id === p.id);
      if (!ov) {
        init[p.id] = { status: "present" };
      } else if (ov.override_group_id === null) {
        init[p.id] = { status: "absent" };
      } else if (ov.override_group_id === group.id) {
        init[p.id] = { status: "present" };
      } else {
        init[p.id] = { status: "move", move_to: ov.override_group_id };
      }
    }
    for (const p of ctx.movedInPlayers as any[]) {
      if (!init[p.id]) init[p.id] = { status: "present" };
    }
    setState(init);
  }, [ctx, group.id]);

  const save = useMutation({
    mutationFn: () =>
      saveRegister({
        data: {
          session_id: session.id,
          group_id: group.id,
          entries: Object.entries(state).map(([player_id, v]) => ({
            player_id,
            status: v.status,
            move_to_group_id: v.status === "move" ? (v.move_to ?? null) : null,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Register confirmed");
      qc.invalidateQueries({ queryKey: qk.match.contextForSession(session.id) });
      qc.invalidateQueries({ queryKey: qk.groups.forBlock(session.block_id) });
      onProceed();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unlock = useMutation({
    mutationFn: () => unlockRegister({ data: { session_id: session.id, group_id: group.id } }),
    onSuccess: () => {
      toast.success("Register unlocked");
      qc.invalidateQueries({ queryKey: qk.match.contextForSession(session.id) });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !ctx) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const otherGroups = (allGroups as any[]).filter((g) => g.id !== group.id);

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
                    onClick={() =>
                      setState({
                        ...state,
                        [p.id]:
                          s.status === "move"
                            ? { status: "present" }
                            : { status: "move", move_to: otherGroups[0]?.id },
                      })
                    }
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" /> Move
                  </PillBtn>
                </div>
              </div>
              {s.status === "move" && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {otherGroups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() =>
                        setState({ ...state, [p.id]: { status: "move", move_to: g.id } })
                      }
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs",
                        s.move_to === g.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background",
                      )}
                    >
                      Group {g.group_number}
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
                  Moved in from other groups
                </p>
                <ul className="space-y-2">
                  {(ctx.movedInPlayers as any[]).map(renderRow)}
                </ul>
              </>
            )}
          </>
        );
      })()}

      <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Saving…" : "Confirm Register"}
      </Button>
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

function RateStep({ session, group, onDone }: { session: any; group: any; onDone: () => void }) {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: ctx, isLoading } = useQuery({
    queryKey: qk.match.context(session.id, group.id),
    queryFn: () => getMatchDayContext({ data: { session_id: session.id, group_id: group.id } }),
    staleTime: 0,
  });

  const presentPlayers = useMemo(() => {
    if (!ctx) return [] as any[];
    const overrideById = new Map((ctx.overrides as any[]).map((o) => [o.player_id, o]));
    const here = (ctx.defaultRoster as any[]).filter((p) => {
      const ov = overrideById.get(p.id);
      if (!ov) return true; // default
      return ov.override_group_id === group.id;
    });
    return [...here, ...(ctx.movedInPlayers as any[])];
  }, [ctx, group.id]);

  const [scores, setScores] = useState<Record<string, any>>({});
  const [activeDescriptor, setActiveDescriptor] = useState<string | null>(null);

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
  }, [ctx, presentPlayers]);

  const hasExisting = (ctx?.ratings as any[] | undefined)?.length ?? 0;

  const submit = useMutation({
    mutationFn: () =>
      submitRatings({
        data: {
          session_id: session.id,
          group_id: group.id,
          block_id: session.block_id,
          ratings: presentPlayers.map((p) => ({
            player_id: p.id,
            ...scores[p.id],
          })),
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
        description: "Ratings already exist for this group/session. Submitting will overwrite them.",
        confirmLabel: "Overwrite",
        destructive: true,
      });
      if (!ok) return;
    }
    submit.mutate();
  };

  if (isLoading || !ctx) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!presentPlayers.length)
    return (
      <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        No players marked present.
      </p>
    );

  return (
    <div className="space-y-3">
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
                      const id = `${p.id}-${sk.key}-${n}`;
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
              {activeDescriptor?.startsWith(`${p.id}-`) && (
                <p className="pt-1 text-right text-xs italic text-accent">
                  {DESCRIPTORS[Number(activeDescriptor.split("-").pop())]}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Button className="w-full" onClick={handleSubmit} disabled={submit.isPending}>
        {submit.isPending ? "Saving…" : "Submit Ratings"}
      </Button>
      {confirmDialog}
    </div>
  );
}
