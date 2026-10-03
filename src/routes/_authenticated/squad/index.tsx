import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GROUPINGS, groupingInfo } from "@/lib/groupings";
import { cn } from "@/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { listSquad } from "@/lib/players/players.functions";
import { ChevronRight } from "lucide-react";

const playersQuery = {
  queryKey: qk.players.squad,
  queryFn: () => listSquad(),
};

export const Route = createFileRoute("/_authenticated/squad/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQuery),
  component: SquadPage,
});

import { SKILLS, ATTRIBUTES } from "@/lib/skills";
import { qk } from "@/lib/query-keys";

type SortMode = "az" | "group";
const SORT_KEY = "squad-sort";

function readSort(): SortMode {
  try {
    return localStorage.getItem(SORT_KEY) === "group" ? "group" : "az";
  } catch {
    return "az";
  }
}

function SquadPage() {
  const { data: players } = useSuspenseQuery(playersQuery);
  const [sort, setSortState] = useState<SortMode>("az");
  useEffect(() => setSortState(readSort()), []);
  const setSort = (m: SortMode) => {
    setSortState(m);
    try {
      localStorage.setItem(SORT_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const list = players as any[];
  const az = [...list].sort((a, b) => a.player_name.localeCompare(b.player_name));
  const sections =
    sort === "az"
      ? [{ key: "all", label: null as string | null, players: az }]
      : [
          ...GROUPINGS.map((g) => ({
            key: g.value as string,
            label: `${g.value} · ${g.note}`,
            players: az.filter((p) => p.player_grouping === g.value),
          })),
          {
            key: "none",
            label: "No grouping",
            players: az.filter((p) => !groupingInfo(p.player_grouping)),
          },
        ].filter((sec) => sec.players.length > 0);

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Squad</p>
        <h1 className="mt-1 text-2xl font-bold text-primary">All players</h1>
        <p className="mt-1 text-sm text-muted-foreground">{players.length} players</p>
      </header>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Sort</span>
        <div className="inline-flex rounded-lg border bg-card p-0.5">
          {(
            [
              ["az", "A to Z"],
              ["group", "Grouping"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setSort(m)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                sort === m ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {sections.map((sec) => (
        <section key={sec.key} className="mb-5">
          {sec.label && (
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {sec.label} · {sec.players.length}
            </h2>
          )}
          <ul className="space-y-2">
            {sec.players.map((p) => (
              <li key={p.id}>
                <PlayerRow p={p} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

function GroupingTile({ value }: { value: string | null | undefined }) {
  const info = groupingInfo(value);
  return (
    <div
      title={info ? `${info.group}: ${info.band}. ${info.note}` : "No grouping"}
      className={cn(
        "flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-lg",
        info ? "bg-primary text-primary-foreground" : "border border-dashed text-muted-foreground",
      )}
    >
      <span className="text-lg font-bold leading-none tabular-nums">{info ? info.value : "-"}</span>
      <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider opacity-80">
        Group
      </span>
    </div>
  );
}

function PlayerRow({ p }: { p: any }) {
  return (
    <Link
      to="/squad/$playerId"
      params={{ playerId: p.id }}
      className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-secondary"
    >
      <GroupingTile value={p.player_grouping} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{p.player_name}</p>
        <div className="mt-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Skills
          </p>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[15px] text-muted-foreground">
            {SKILLS.map((s) => (
              <span key={s.key} className="tabular-nums">
                {s.short} <span className="font-semibold text-foreground">{p[s.key]}</span>
              </span>
            ))}
          </div>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Attributes
          </p>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[15px] text-muted-foreground/80">
            {ATTRIBUTES.map((a) => (
              <span key={a.key} className="tabular-nums italic">
                {a.short} <span className="font-medium not-italic">{p[a.key]}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
    </Link>
  );
}
