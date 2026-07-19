import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/lib/sessions/sessions.functions";
import { listGroupsForBlock } from "@/lib/match/match.functions";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateLong } from "@/lib/dates";
import { qk } from "@/lib/query-keys";

export const Route = createFileRoute("/_authenticated/session-info/$sessionId")({
  component: SessionInfoPage,
});

function SessionInfoPage() {
  const { sessionId } = Route.useParams();
  const router = useRouter();
  const { data: session } = useQuery({
    queryKey: qk.sessions.detail(sessionId),
    queryFn: () => getSession({ data: { id: sessionId } }),
  });
  const { data: groups = [] } = useQuery({
    queryKey: qk.groups.forBlock(session?.block_id ?? ""),
    queryFn: () => listGroupsForBlock({ data: { block_id: session!.block_id } }),
    enabled: !!session?.block_id,
  });

  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else router.navigate({ to: "/calendar" });
  };

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-24">
      <header className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Training Session
          </p>
          <h1 className="mt-1 text-2xl font-bold text-primary">
            {session ? formatDateLong(session.session_date) : "…"}
          </h1>
          {session && <p className="text-xs text-muted-foreground">{session.block_name}</p>}
        </div>
      </header>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-primary">Active groups</h2>
        {!groups.length ? (
          <p className="text-sm text-muted-foreground">No groups configured for this block.</p>
        ) : (
          <ul className="space-y-2">
            {groups.map((g: any) => (
              <li
                key={g.id}
                className="flex items-center justify-between rounded border bg-background px-4 py-3"
              >
                <span className="font-semibold">Group {g.group_number}</span>
                <span className="text-xs text-muted-foreground">
                  {g.coaches.length ? g.coaches.join(", ") : "No coaches assigned"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
