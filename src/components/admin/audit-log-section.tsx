import { useQuery } from "@tanstack/react-query";
import { listAuditLog } from "@/lib/players/players.functions";
import { qk } from "@/lib/query-keys";
import { QueryError } from "@/components/query-error";
import { formatUKDateTime } from "@/lib/dates";

export function AuditLogSection() {
  const {
    data: rows = [],
    isError: logError,
    refetch: refetchLog,
  } = useQuery({
    queryKey: qk.auditLog,
    queryFn: () => listAuditLog({ data: { limit: 50 } }),
  });

  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-1 text-sm font-semibold">Audit log</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Most recent 50 changes to permanent player records.
      </p>
      {logError ? (
        <QueryError message="Couldn't load audit log" onRetry={() => refetchLog()} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No audit entries yet.</p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-auto text-xs">
          {rows.map((r: any) => {
            const playerName = r.metadata?.player_name as string | undefined;
            const isSkillRatings = r.table_name === "skill_ratings";
            const changed = (r.metadata?.changed_fields as string[] | undefined) ?? null;
            const attr = r.metadata?.attribute as string | undefined;
            return (
              <li key={r.id} className="rounded-md border bg-background px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    {playerName ?? r.table_name}
                    {isSkillRatings
                      ? ` · Week ${r.metadata?.week_number ?? "?"} · Group ${r.metadata?.group_number ?? "?"}`
                      : ` · ${attr ?? r.operation}`}
                  </span>
                  <span className="text-muted-foreground">{formatUKDateTime(r.created_at)}</span>
                </div>
                {isSkillRatings && changed ? (
                  <ul className="mt-0.5 space-y-0.5 text-muted-foreground">
                    {changed.map((k) => (
                      <li key={k}>
                        {k}: {r.old_values?.[k] ?? "—"} →{" "}
                        <span className="font-semibold text-primary">{r.new_values?.[k]}</span>
                      </li>
                    ))}
                  </ul>
                ) : attr ? (
                  <p className="mt-0.5 text-muted-foreground">
                    {r.old_values?.[attr] ?? "—"} →{" "}
                    <span className="font-semibold text-primary">{r.new_values?.[attr]}</span>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
