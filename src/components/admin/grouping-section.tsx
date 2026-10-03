import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { updatePlayerGrouping, listSquad } from "@/lib/players/players.functions";
import { GROUPINGS, groupingInfo, groupingRank, type GroupingValue } from "@/lib/groupings";
import { GroupingSelect } from "@/components/grouping-select";
import { toast } from "sonner";
import { qk } from "@/lib/query-keys";

export function GroupingSection() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const { data: players = [], isLoading } = useQuery({
    queryKey: qk.players.squad,
    queryFn: () => listSquad(),
  });

  const update = useMutation({
    mutationFn: (v: { id: string; player_grouping: GroupingValue | null }) =>
      updatePlayerGrouping({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.players.squad });
      qc.invalidateQueries({ queryKey: qk.players.all });
      toast.success("Grouping updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sorted = [...(players as any[])].sort(
    (a, b) =>
      groupingRank(a.player_grouping) - groupingRank(b.player_grouping) ||
      a.player_name.localeCompare(b.player_name),
  );
  const visible =
    filter === "all"
      ? sorted
      : filter === "unassigned"
        ? sorted.filter((p) => !p.player_grouping)
        : sorted.filter((p) => p.player_grouping === filter);
  const countFor = (v: string | null) =>
    (players as any[]).filter((p) => (p.player_grouping ?? null) === v).length;

  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-1 text-sm font-semibold">Grouping</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        1+ to 4. Visible to all coaches, never to parents or players.
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {[
          { value: "all", label: `All ${players.length}` },
          ...GROUPINGS.map((g) => ({ value: g.value, label: `${g.value} · ${countFor(g.value)}` })),
          { value: "unassigned", label: `Unassigned · ${countFor(null)}` },
        ].map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setFilter(chip.value)}
            className={`rounded-full border px-2.5 py-1 text-xs tabular-nums ${
              filter === chip.value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="max-h-96 space-y-1.5 overflow-auto">
          {visible.map((p) => {
            const info = groupingInfo(p.player_grouping);
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.player_name}</p>
                  {info && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {info.group} · {info.note}
                    </p>
                  )}
                </div>
                <GroupingSelect
                  value={p.player_grouping}
                  onChange={(v) =>
                    update.mutate({ id: p.id, player_grouping: v as GroupingValue | null })
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
