import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getMyRole } from "@/lib/auth/roles.functions";
import {
  listBlocksWithMeta,
  getBlockBuilderData,
  saveBlock,
  setActiveBlock,
} from "@/lib/blocks/blocks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Plus, Pencil, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/block-builder")({
  beforeLoad: async () => {
    const me = await getMyRole();
    if (!me.isBlockBuilder) throw redirect({ to: "/home" });
  },
  component: BlockBuilderPage,
});

type Mode =
  | { kind: "list" }
  | { kind: "edit"; blockId: string | null };

function BlockBuilderPage() {
  const [mode, setMode] = useState<Mode>({ kind: "list" });

  return (
    <main className="mx-auto max-w-5xl px-5 pt-8 pb-32">
      {mode.kind === "list" ? (
        <BlockList
          onCreate={() => setMode({ kind: "edit", blockId: null })}
          onEdit={(id) => setMode({ kind: "edit", blockId: id })}
        />
      ) : (
        <BlockEditor
          blockId={mode.blockId}
          onDone={() => setMode({ kind: "list" })}
        />
      )}
    </main>
  );
}

function BlockList({
  onCreate,
  onEdit,
}: {
  onCreate: () => void;
  onEdit: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ["blocks-meta"],
    queryFn: () => listBlocksWithMeta(),
  });

  const activate = useMutation({
    mutationFn: (id: string) => setActiveBlock({ data: { id } }),
    onSuccess: () => {
      toast.success("Block set active");
      qc.invalidateQueries({ queryKey: ["blocks-meta"] });
      qc.invalidateQueries({ queryKey: ["blocks"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <Link to="/admin" className="text-xs text-muted-foreground hover:underline">
            <ChevronLeft className="inline h-3 w-3" /> Admin
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-primary">Block Builder</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage training blocks, groups and assignments.
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4" /> Create New Block
        </Button>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No blocks yet.</p>
      ) : (
        <ul className="space-y-3">
          {blocks.map((b: any) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">
                    {b.name ?? `Block ${b.block_number}`}
                  </h3>
                  {b.is_active && <Badge>Active</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {b.start_date ?? "—"} → {b.end_date ?? "—"} · {b.group_count} groups
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {!b.is_active && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => activate.mutate(b.id)}
                    disabled={activate.isPending}
                  >
                    <Check className="h-4 w-4" /> Set active
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => onEdit(b.id)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const SKILLS = ["tackling", "rucking", "carrying", "kicking", "catching", "iq"] as const;
type SkillKey = (typeof SKILLS)[number];
const SKILL_LABELS: Record<SkillKey, string> = {
  tackling: "Tac",
  rucking: "Ruc",
  carrying: "Car",
  kicking: "Kic",
  catching: "Cat",
  iq: "IQ",
};

type SortKey = "name" | "attendance" | SkillKey;

type GroupState = { coach_ids: string[]; player_ids: string[] };

function BlockEditor({ blockId, onDone }: { blockId: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["block-builder", blockId],
    queryFn: () => getBlockBuilderData({ data: { block_id: blockId } }),
  });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [groups, setGroups] = useState<GroupState[]>([
    { coach_ids: [], player_ids: [] },
    { coach_ids: [], player_ids: [] },
    { coach_ids: [], player_ids: [] },
    { coach_ids: [], player_ids: [] },
  ]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [initialized, setInitialized] = useState(false);

  // Initialize once
  if (data && !initialized) {
    if (data.block) {
      setName(data.block.name ?? "");
      setStartDate(data.block.start_date ?? "");
      setEndDate(data.block.end_date ?? "");
      setIsActive(!!data.block.is_active);
    }
    const base: GroupState[] = [1, 2, 3, 4].map((n) => {
      const g = data.groups.find((x) => x.group_number === n);
      return g
        ? { coach_ids: g.coach_ids, player_ids: g.player_ids }
        : { coach_ids: [], player_ids: [] };
    });
    setGroups(base);
    setInitialized(true);
  }

  const assignedIds = useMemo(
    () => new Set(groups.flatMap((g) => g.player_ids)),
    [groups],
  );

  const pool = useMemo(() => {
    if (!data) return [];
    const list = data.players.filter((p: any) => !assignedIds.has(p.id));
    const sorted = [...list].sort((a: any, b: any) => {
      if (sortKey === "name") return a.player_name.localeCompare(b.player_name);
      if (sortKey === "attendance") {
        return (b.attendance_pct ?? -1) - (a.attendance_pct ?? -1);
      }
      return (b[sortKey] ?? 0) - (a[sortKey] ?? 0);
    });
    return sorted;
  }, [data, assignedIds, sortKey]);

  const playerMap = useMemo(() => {
    const m = new Map<string, any>();
    (data?.players ?? []).forEach((p: any) => m.set(p.id, p));
    return m;
  }, [data]);

  function assignToGroup(groupIdx: number) {
    if (!selectedPlayer) return;
    setGroups((prev) => {
      const next = prev.map((g) => ({
        ...g,
        player_ids: g.player_ids.filter((id) => id !== selectedPlayer),
      }));
      next[groupIdx] = {
        ...next[groupIdx],
        player_ids: [...next[groupIdx].player_ids, selectedPlayer],
      };
      return next;
    });
    setSelectedPlayer(null);
  }

  function unassign(playerId: string) {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        player_ids: g.player_ids.filter((id) => id !== playerId),
      })),
    );
    setSelectedPlayer(null);
  }

  function toggleCoach(groupIdx: number, coachId: string) {
    setGroups((prev) => {
      const next = [...prev];
      const has = next[groupIdx].coach_ids.includes(coachId);
      next[groupIdx] = {
        ...next[groupIdx],
        coach_ids: has
          ? next[groupIdx].coach_ids.filter((c) => c !== coachId)
          : [...next[groupIdx].coach_ids, coachId],
      };
      return next;
    });
  }

  const save = useMutation({
    mutationFn: () =>
      saveBlock({
        data: {
          id: blockId,
          name,
          start_date: startDate,
          end_date: endDate,
          is_active: isActive,
          groups: groups.map((g, i) => ({
            group_number: i + 1,
            coach_ids: g.coach_ids,
            player_ids: g.player_ids,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Block saved");
      qc.invalidateQueries({ queryKey: ["blocks-meta"] });
      qc.invalidateQueries({ queryKey: ["blocks"] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <>
      <header className="mb-6">
        <button
          className="text-xs text-muted-foreground hover:underline"
          onClick={onDone}
        >
          <ChevronLeft className="inline h-3 w-3" /> Back to blocks
        </button>
        <h1 className="mt-1 text-2xl font-bold text-primary">
          {blockId ? "Edit block" : "Create block"}
        </h1>
        <div className="mt-3 flex gap-2 text-xs">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`rounded-full px-3 py-1 ${
                step === s ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              Step {s}
            </div>
          ))}
        </div>
      </header>

      {step === 1 && (
        <section className="space-y-4 rounded-lg border bg-card p-5">
          <div className="space-y-2">
            <Label htmlFor="bb-name">Block name</Label>
            <Input
              id="bb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Block 1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="bb-start">Start date</Label>
              <Input
                id="bb-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bb-end">End date</Label>
              <Input
                id="bb-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="bb-active">Active</Label>
            <Switch id="bb-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <Button
            className="w-full"
            disabled={!name || !startDate || !endDate}
            onClick={() => setStep(2)}
          >
            Next
          </Button>
        </section>
      )}

      {step === 2 && (
        <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* Pool */}
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Pool ({pool.length})</h3>
            </div>
            <div className="mb-3 flex flex-wrap gap-1">
              <SortBtn label="Name" active={sortKey === "name"} onClick={() => setSortKey("name")} />
              <SortBtn
                label="Att%"
                active={sortKey === "attendance"}
                onClick={() => setSortKey("attendance")}
              />
              {SKILLS.map((s) => (
                <SortBtn
                  key={s}
                  label={SKILL_LABELS[s]}
                  active={sortKey === s}
                  onClick={() => setSortKey(s)}
                />
              ))}
            </div>
            <ul className="max-h-[60vh] space-y-1 overflow-auto">
              {pool.map((p: any) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  selected={selectedPlayer === p.id}
                  onClick={() =>
                    setSelectedPlayer((cur) => (cur === p.id ? null : p.id))
                  }
                  showPrev
                />
              ))}
            </ul>
          </div>

          {/* Groups */}
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((g, i) => (
              <GroupColumn
                key={i}
                index={i}
                group={g}
                coaches={data.coaches}
                playerMap={playerMap}
                onAssign={() => assignToGroup(i)}
                canAssign={!!selectedPlayer}
                onUnassign={unassign}
                onToggleCoach={(cid) => toggleCoach(i, cid)}
                onSelect={(pid) => setSelectedPlayer((cur) => (cur === pid ? null : pid))}
                selectedPlayer={selectedPlayer}
              />
            ))}
          </div>

          <div className="lg:col-span-2 flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)}>Review</Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((g, i) => (
              <GroupSummary
                key={i}
                index={i}
                group={g}
                coaches={data.coaches}
                playerMap={playerMap}
              />
            ))}
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save Block"}
            </Button>
          </div>
        </section>
      )}
    </>
  );
}

function SortBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function attColor(pct: number | null) {
  if (pct === null) return "bg-muted text-muted-foreground";
  if (pct >= 80) return "bg-green-500/20 text-green-700 dark:text-green-300";
  if (pct >= 50) return "bg-amber-500/20 text-amber-700 dark:text-amber-300";
  return "bg-red-500/20 text-red-700 dark:text-red-300";
}

function PlayerCard({
  player,
  selected,
  onClick,
  showPrev,
}: {
  player: any;
  selected: boolean;
  onClick: () => void;
  showPrev?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full rounded-md border px-2 py-1.5 text-left transition-colors ${
          selected ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{player.player_name}</span>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${attColor(
              player.attendance_pct,
            )}`}
          >
            {player.attendance_pct === null ? "—" : `${player.attendance_pct}%`}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {SKILLS.map((s) => (
            <span
              key={s}
              className="rounded bg-secondary px-1 py-0.5 text-[10px] font-semibold"
              title={s}
            >
              {SKILL_LABELS[s]} {player[s]}
            </span>
          ))}
        </div>
        {showPrev && player.previous_group != null && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Last: Group {player.previous_group}
          </p>
        )}
      </button>
    </li>
  );
}

function GroupColumn({
  index,
  group,
  coaches,
  playerMap,
  onAssign,
  canAssign,
  onUnassign,
  onToggleCoach,
  onSelect,
  selectedPlayer,
}: {
  index: number;
  group: GroupState;
  coaches: any[];
  playerMap: Map<string, any>;
  onAssign: () => void;
  canAssign: boolean;
  onUnassign: (id: string) => void;
  onToggleCoach: (id: string) => void;
  onSelect: (id: string) => void;
  selectedPlayer: string | null;
}) {
  const groupPlayers = group.player_ids
    .map((id) => playerMap.get(id))
    .filter(Boolean);
  const avgSkill =
    groupPlayers.length === 0
      ? 0
      : groupPlayers.reduce((sum: number, p: any) => {
          return sum + SKILLS.reduce((a, s) => a + (p[s] ?? 0), 0) / SKILLS.length;
        }, 0) / groupPlayers.length;
  const attVals = groupPlayers
    .map((p: any) => p.attendance_pct)
    .filter((v: number | null): v is number => v !== null);
  const avgAtt =
    attVals.length === 0 ? null : Math.round(attVals.reduce((a, b) => a + b, 0) / attVals.length);

  return (
    <div className="flex flex-col rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-semibold">Group {index + 1}</h4>
        <button
          type="button"
          onClick={onAssign}
          disabled={!canAssign}
          className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-30"
        >
          + Assign
        </button>
      </div>
      <div className="mb-2">
        <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Coaches</p>
        <div className="flex flex-wrap gap-1">
          {coaches.map((c: any) => {
            const sel = group.coach_ids.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onToggleCoach(c.id)}
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  sel
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-foreground"
                }`}
              >
                {c.coach_name}
              </button>
            );
          })}
        </div>
      </div>
      <ul className="flex-1 space-y-1">
        {groupPlayers.map((p: any) => (
          <li key={p.id}>
            <div
              className={`rounded-md border px-2 py-1 ${
                selectedPlayer === p.id ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className="truncate text-left text-xs font-medium"
                >
                  {p.player_name}
                </button>
                <button
                  type="button"
                  onClick={() => onUnassign(p.id)}
                  className="text-[10px] text-destructive"
                >
                  Remove
                </button>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {SKILLS.map((s) => (
                  <span
                    key={s}
                    className="rounded bg-secondary px-1 text-[9px] font-semibold"
                  >
                    {SKILL_LABELS[s]} {p[s]}
                  </span>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 border-t pt-2 text-[10px] text-muted-foreground">
        <p>
          {groupPlayers.length} players · avg skill {avgSkill.toFixed(2)} · avg att{" "}
          {avgAtt === null ? "—" : `${avgAtt}%`}
        </p>
      </div>
    </div>
  );
}

function GroupSummary({
  index,
  group,
  coaches,
  playerMap,
}: {
  index: number;
  group: GroupState;
  coaches: any[];
  playerMap: Map<string, any>;
}) {
  const groupPlayers = group.player_ids
    .map((id) => playerMap.get(id))
    .filter(Boolean);
  const coachNames = group.coach_ids
    .map((id) => coaches.find((c: any) => c.id === id)?.coach_name)
    .filter(Boolean) as string[];
  const avgSkill =
    groupPlayers.length === 0
      ? 0
      : groupPlayers.reduce((sum: number, p: any) => {
          return sum + SKILLS.reduce((a, s) => a + (p[s] ?? 0), 0) / SKILLS.length;
        }, 0) / groupPlayers.length;
  return (
    <div className="rounded-lg border bg-card p-4">
      <h4 className="font-semibold">Group {index + 1}</h4>
      <p className="text-xs text-muted-foreground">
        {coachNames.length ? coachNames.join(", ") : "No coach assigned"}
      </p>
      <p className="mt-1 text-xs">
        {groupPlayers.length} players · avg skill {avgSkill.toFixed(2)}
      </p>
      <ul className="mt-2 space-y-0.5 text-sm">
        {groupPlayers.map((p: any) => (
          <li key={p.id}>{p.player_name}</li>
        ))}
      </ul>
    </div>
  );
}
