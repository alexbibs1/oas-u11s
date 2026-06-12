import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMyRole } from "@/lib/auth/roles.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

function HomePage() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMyRole() });

  const nameFromEmail = me?.email
    ? me.email.split("@")[0].split(/[._-]/)[0].replace(/^\w/, (c) => c.toUpperCase())
    : null;
  const displayName = me?.coachName ?? nameFromEmail ?? "Coach";

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">OA Rugby</p>
          <h1 className="mt-1 text-3xl font-bold text-primary">Welcome, {displayName}</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/auth";
          }}
        >
          Sign out
        </Button>
      </header>

      <section className="space-y-4">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Current block</h2>
          <p className="mt-2 text-sm">Block summary will appear here.</p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Your group this week</h2>
          <p className="mt-2 text-sm">Coming soon.</p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">News feed</h2>
          <p className="mt-2 text-sm">Coming soon.</p>
        </div>
      </section>
    </main>
  );
}
