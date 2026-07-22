import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { getGroupDetail } from "@/lib/match/match.functions";
import { useMyRole } from "@/lib/auth/view-as";
import { SKILLS, ATTRIBUTES } from "@/lib/skills";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/group/$groupId")({
  component: GroupDetailPage,
});

function quartileColor(q: number | null | undefined): string {
  switch (q) {
    case 1:
      return "bg-emerald-100 text-emerald-800";
    case 2:
      return "bg-blue-100 text-blue-800";
    case 3:
      return "bg-amber-100 text-amber-800";
    case 4:
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function GroupDetailPage() {
  const { groupId } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["group-detail", groupId],
    queryFn: () => getGroupDetail({ data: { group_id: groupId } }),
  });
  const { data: me } = useMyRole();

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-2xl px-5 pt-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  const { group, coaches, players } = data;
  const total = players.length;
  const qCount = (q: number) => players.filter((p: any) => p.quartile === q).length;
  const q1 = qCount(1);
  const q2 = qCount(2);
  const q3 = qCount(3);
  const q4 = qCount(4);
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  const isAdmin = !!me?.isBlockBuilder;

  const avgFor = (key: string) =>
    total === 0 ? 0 : players.reduce((s: number, p: any) => s + ((p as any)[key] ?? 0), 0) / total;
  const overallAvg =
    total === 0
      ? 0
      : players.reduce((s: number, p: any) => {
          const keys = [...SKILLS, ...ATTRIBUTES];
          const vals = keys.map((k) => (p as any)[k.key] ?? 0);
          return s + vals.reduce((a, b) => a + b, 0) / vals.length;
        }, 0) / total;

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

      {total > 0 && (
        <section className="mb-6 rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Group balance</h2>

          <div className={isAdmin ? "mb-4" : "mb-2"}>
            <p className="mb-1 text-xs text-muted-foreground">Quartile distribution</p>
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              <div className="bg-emerald-500" style={{ width: `${pct(q1)}%` }} title={`Q1: ${q1}`} />
              <div className="bg-blue-500" style={{ width: `${pct(q2)}%` }} title={`Q2: ${q2}`} />
              <div className="bg-amber-500" style={{ width: `${pct(q3)}%` }} title={`Q3: ${q3}`} />
              <div className="bg-slate-400" style={{ width: `${pct(q4)}%` }} title={`Q4: ${q4}`} />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span className="font-semibold text-emerald-600">Q1: {q1}</span>
              <span className="font-semibold text-blue-600">Q2: {q2}</span>
              <span className="font-semibold text-amber-600">Q3: {q3}</span>
              <span className="font-semibold text-slate-600">Q4: {q4}</span>
            </div>
          </div>

          {isAdmin ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {SKILLS.map((s) => (
                  <div key={s.key} className="rounded border bg-background p-2 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">{s.short}</p>
                    <p className="text-lg font-bold tabular-nums text-primary">
                      {avgFor(s.key).toFixed(1)}
                    </p>
                  </div>
                ))}
                {ATTRIBUTES.map((a) => (
                  <div key={a.key} className="rounded border border-dashed bg-background p-2 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">{a.short}</p>
                    <p className="text-lg font-bold tabular-nums text-primary">
                      {avgFor(a.key).toFixed(1)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded border border-primary/30 bg-primary/5 p-2 text-center">
                <p className="text-xs text-muted-foreground">Overall average</p>
                <p className="text-2xl font-bold tabular-nums text-primary">
                  {overallAvg.toFixed(2)}
                </p>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              A balanced group has a mix across all four quartiles.
            </p>
          )}
        </section>
      )}

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
                  <p className="truncate font-medium">
                    {p.player_name}
                    {p.quartile != null && (
                      <span
                        className={`ml-2 rounded px-1 py-0.5 text-[9px] font-bold ${quartileColor(p.quartile)}`}
                      >
                        Q{p.quartile}
                      </span>
                    )}
                  </p>
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
