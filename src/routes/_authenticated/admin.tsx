import { createFileRoute, redirect } from "@tanstack/react-router";
import { getMyRole } from "@/lib/auth/roles.functions";
import { Switch } from "@/components/ui/switch";
import { setViewAsCoach, useMyRole } from "@/lib/auth/view-as";
import { SessionsSection } from "@/components/admin/sessions-section";
import { GroupingSection } from "@/components/admin/grouping-section";
import { InviteSection } from "@/components/admin/invite-section";
import { CoachAccountsSection } from "@/components/admin/coach-accounts-section";
import { PlayersSection } from "@/components/admin/players-section";
import { CoachesSection } from "@/components/admin/coaches-section";
import { AttributesSection } from "@/components/admin/attributes-section";
import { CompletionTrackerSection } from "@/components/admin/completion-tracker-section";
import { AuditLogSection } from "@/components/admin/audit-log-section";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const me = await getMyRole();
    if (!me.isAdmin) throw redirect({ to: "/home" });
  },
  component: AdminPage,
});

function SectionHeading({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">{label}</p>
      <h2 className="text-lg font-bold text-primary">{title}</h2>
    </div>
  );
}

function AdminPage() {
  const { viewAsCoach } = useMyRole();
  return (
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-32">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-primary">Manage</h1>
        <div className="mt-3 flex items-center justify-between rounded-lg border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-semibold">View as coach</p>
            <p className="text-xs text-muted-foreground">Preview the app without admin tools</p>
          </div>
          <Switch
            checked={!!viewAsCoach}
            onCheckedChange={(checked) => setViewAsCoach(checked)}
            aria-label="View as coach"
          />
        </div>
      </header>

      {/* 1. People */}
      <section className="mb-8">
        <SectionHeading label="1 · People" title="People" />
        <InviteSection />
        <CoachAccountsSection />
      </section>

      {/* 2. Structure */}
      <section className="mb-8">
        <SectionHeading label="2 · Structure" title="Structure" />
        <div className="space-y-3">
          <GroupingSection />
        </div>
      </section>

      {/* 3. Sessions */}
      <section className="mb-10">
        <SectionHeading label="3 · Sessions" title="Sessions" />
        <div className="space-y-5">
          <SessionsSection />
          <CompletionTrackerSection />
        </div>
      </section>

      {/* 4. Player Data */}
      <div className="my-8 border-t-2 border-dashed border-accent/40" />

      <section className="space-y-5 rounded-xl border-2 border-accent/30 bg-accent/5 p-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
            4 · Player Data
          </p>
          <h2 className="text-lg font-bold text-primary">Player Data</h2>
          <p className="text-xs text-muted-foreground">
            Edits here change permanent player records.
          </p>
        </div>
        <AttributesSection />
        <PlayersSection />
        <CoachesSection />
        <AuditLogSection />
      </section>
    </main>
  );
}
