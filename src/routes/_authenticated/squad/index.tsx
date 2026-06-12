import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { listPlayers } from "@/lib/players/players.functions";
import { ChevronRight } from "lucide-react";

const playersQuery = {
  queryKey: ["players"],
  queryFn: () => listPlayers(),
};

export const Route = createFileRoute("/_authenticated/squad/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQuery),
  component: SquadPage,
});

const skills = [
  { key: "tackling", label: "Tac" },
  { key: "rucking", label: "Ruc" },
  { key: "kicking", label: "Kic" },
  { key: "catching", label: "Cat" },
  { key: "iq", label: "IQ" },
  { key: "speed", label: "Spd" },
] as const;

function SquadPage() {
  const { data: players } = useSuspenseQuery(playersQuery);

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Squad</p>
        <h1 className="mt-1 text-2xl font-bold text-primary">All players</h1>
        <p className="mt-1 text-sm text-muted-foreground">{players.length} players</p>
      </header>

      <ul className="space-y-2">
        {players.map((p: any) => (
          <li key={p.id}>
            <Link
              to="/squad/$playerId"
              params={{ playerId: p.id }}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-secondary"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{p.player_name}</p>
                <div className="mt-1 flex gap-2 text-[11px] text-muted-foreground">
                  {skills.map((s) => (
                    <span key={s.key} className="tabular-nums">
                      {s.label} <span className="font-semibold text-foreground">{p[s.key]}</span>
                    </span>
                  ))}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
