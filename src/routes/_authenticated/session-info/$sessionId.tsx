import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/lib/sessions/sessions.functions";
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
  const {
    data: session,
    isLoading,
    isError,
  } = useQuery({
    queryKey: qk.sessions.detail(sessionId),
    queryFn: () => getSession({ data: { id: sessionId } }),
  });

  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else router.navigate({ to: "/calendar" });
  };

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-5 pt-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (isError || !session) {
    return (
      <main className="mx-auto max-w-2xl px-5 pt-8">
        <p className="text-lg font-semibold text-primary">Session not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This session may have been deleted, or the link is incorrect.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => router.navigate({ to: "/calendar" })}
        >
          Go to calendar
        </Button>
      </main>
    );
  }

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
            {formatDateLong(session.session_date)}
          </h1>
        </div>
      </header>

      <section className="rounded-lg border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          No squad split for training — everyone trains together.
        </p>
      </section>
    </main>
  );
}
