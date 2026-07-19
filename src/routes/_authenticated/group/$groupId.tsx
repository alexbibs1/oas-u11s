import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { getGroupDetail } from "@/lib/match/match.functions";
import { SKILLS, ATTRIBUTES } from "@/lib/skills";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/group/$groupId")({
  component: GroupDetailPage,
});

function GroupDetailPage() {
  const { groupId } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["group-detail", groupId],
    queryFn: () => getGroupDetail({ data: { group_id: groupId } }),
  });

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-2xl px-5 pt-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  const { group, coaches, players } = data;

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-32">
      <header className="mb-6">
        <Link to="/home" className="text-xs font-semibold text-accent hover:underline">
          ← Back to home
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-accent">
          {(group.block as any)?.name ?? `Block ${(group.block as any)?.block_number ?? ""}`}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-primary">Group {group.group_number}</h1>
        {coaches.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">Coach {coaches.join(", ")}</p>
        )}
      </header>

      <div className="mb-6">
        <Button asChild className="w-full">
          <Link to="/match-day">Start Match Day</Link>
        </Button>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
        Players ({players.length})
      </h2>

      {players.length === 0 ? (
        <p className="text-sm text-muted-foreground">No players in this group yet.</p>
      ) : (
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
                  <div className="mt-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Skills
                    </p>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
                      {SKILLS.map((s) => (
                        <span key={s.key} className="tabular-nums">
                          {s.short}{" "}
                          <span className="font-semibold text-foreground">{p[s.key]}</span>
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Attributes
                    </p>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground/80">
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
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
