import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getPlayer } from "@/lib/players/players.functions";
import { ChevronLeft } from "lucide-react";

const playerQuery = (id: string) => ({
  queryKey: ["player", id],
  queryFn: () => getPlayer({ data: { id } }),
});

export const Route = createFileRoute("/_authenticated/squad/$playerId")({
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(playerQuery(params.playerId));
    } catch {
      throw notFound();
    }
  },
  component: PlayerProfile,
});

const skills = [
  { key: "tackling", label: "Tackling" },
  { key: "rucking", label: "Rucking" },
  { key: "carrying", label: "Carrying" },
  { key: "kicking", label: "Kicking" },
  { key: "catching", label: "Catching" },
  { key: "iq", label: "Rugby IQ" },
  { key: "speed", label: "Speed" },
] as const;

function PlayerProfile() {
  const { playerId } = Route.useParams();
  const { data: player } = useSuspenseQuery(playerQuery(playerId));

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8">
      <Link
        to="/squad"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Squad
      </Link>

      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Player</p>
        <h1 className="mt-1 text-3xl font-bold text-primary">{(player as any).player_name}</h1>
      </header>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Skills</h2>
        <div className="grid grid-cols-2 gap-3">
          {skills.map((s) => {
            const value = (player as any)[s.key] as number;
            return (
              <div key={s.key} className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-primary">{value}</span>
                  <span className="text-xs text-muted-foreground">/ 5</span>
                </div>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={`h-1.5 flex-1 rounded-full ${
                        n <= value ? "bg-accent" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Notes</h2>
        <div className="rounded-lg border border-dashed bg-card/50 p-5 text-sm text-muted-foreground">
          Notes will appear here.
        </div>
      </section>
    </main>
  );
}
