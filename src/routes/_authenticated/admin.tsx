import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getMyRole } from "@/lib/auth/roles.functions";
import {
  listPlayers,
  addPlayer,
  removePlayer,
  updatePlayerAttribute,
  listAuditLog,
} from "@/lib/players/players.functions";
import { listCoaches, addCoach, removeCoach } from "@/lib/coaches/coaches.functions";
import { inviteUser } from "@/lib/admin/invite.functions";
import { listBlocks, createSession } from "@/lib/sessions/sessions.functions";
import { ATTRIBUTES, REPEATABILITY_DESCRIPTORS } from "@/lib/skills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const me = await getMyRole();
    if (!me.isBlockBuilder) throw redirect({ to: "/home" });
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
  return (
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-32">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-primary">Manage</h1>
      </header>

      {/* 1. People */}
      <section className="mb-8">
        <SectionHeading label="1 · People" title="People" />
        <InviteSection />
      </section>

      {/* 2. Structure */}
      <section className="mb-8">
        <SectionHeading label="2 · Structure" title="Structure" />
        <Link
          to="/block-builder"
          className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-secondary"
        >
          <div>
            <p className="text-sm font-semibold">Block Builder</p>
            <p className="text-xs text-muted-foreground">
              Configure blocks, groups and assignments
            </p>
          </div>
          <span className="text-xs text-muted-foreground">Open →</span>
        </Link>
      </section>

      {/* 3. Sessions */}
      <section className="mb-10">
        <SectionHeading label="3 · Sessions" title="Sessions" />
        <SessionsSection />
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

function SessionsSection() {
  const qc = useQueryClient();
  const { data: blocks = [] } = useQuery({ queryKey: ["blocks"], queryFn: () => listBlocks() });
  const [blockId, setBlockId] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState<"training" | "match">("match");

  const m = useMutation({
    mutationFn: () =>
      createSession({
        data: { block_id: blockId, session_date: date, session_type: type },
      }),
    onSuccess: () => {
      toast.success("Session created");
      setDate("");
      qc.invalidateQueries({ queryKey: ["match-sessions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">Create session</h3>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (blockId && date) m.mutate();
        }}
      >
        <div className="space-y-2">
          <Label>Block</Label>
          <Select value={blockId} onValueChange={setBlockId}>
            <SelectTrigger>
              <SelectValue placeholder="Select block…" />
            </SelectTrigger>
            <SelectContent>
              {blocks.map((b: any) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name ?? `Block ${b.block_number}`} {b.is_active ? "(active)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="session-date">Date</Label>
            <Input
              id="session-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="match">Match</SelectItem>
                <SelectItem value="training">Training</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="submit" disabled={m.isPending || !blockId || !date} className="w-full">
          {m.isPending ? "Creating…" : "Create session"}
        </Button>
      </form>
    </div>
  );
}

function InviteSection() {
  const { data: coaches = [] } = useQuery({ queryKey: ["coaches"], queryFn: () => listCoaches() });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"block_builder" | "coach">("coach");
  const [coachId, setCoachId] = useState<string>("");

  const m = useMutation({
    mutationFn: () =>
      inviteUser({
        data: { email, role, coach_id: role === "coach" ? coachId || null : null },
      }),
    onSuccess: () => {
      toast.success("Invite sent");
      setEmail("");
      setCoachId("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">Invite user</h3>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coach">Coach</SelectItem>
                <SelectItem value="block_builder">Block builder</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role === "coach" && (
            <div className="space-y-2">
              <Label>Coach name</Label>
              <Select value={coachId} onValueChange={setCoachId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {coaches.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.coach_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Button type="submit" disabled={m.isPending} className="w-full">
          {m.isPending ? "Sending…" : "Send invite"}
        </Button>
      </form>
    </div>
  );
}

function PlayersSection() {
  const qc = useQueryClient();
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => listPlayers() });
  const [name, setName] = useState("");

  const add = useMutation({
    mutationFn: () => addPlayer({ data: { player_name: name } }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["players"] });
      toast.success("Player added");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removePlayer({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">Players ({players.length})</h3>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate();
        }}
      >
        <Input
          placeholder="New player name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={add.isPending}>Add</Button>
      </form>
      <ul className="max-h-72 space-y-1 overflow-auto">
        {players.map((p: any) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-secondary"
          >
            <span className="text-sm">{p.player_name}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm(`Remove ${p.player_name}?`)) remove.mutate(p.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CoachesSection() {
  const qc = useQueryClient();
  const { data: coaches = [] } = useQuery({ queryKey: ["coaches"], queryFn: () => listCoaches() });
  const [name, setName] = useState("");

  const add = useMutation({
    mutationFn: () => addCoach({ data: { coach_name: name } }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["coaches"] });
      toast.success("Coach added");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeCoach({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coaches"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">Coaches ({coaches.length})</h3>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate();
        }}
      >
        <Input
          placeholder="New coach name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={add.isPending}>Add</Button>
      </form>
      <ul className="space-y-1">
        {coaches.map((c: any) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-secondary"
          >
            <span className="text-sm">{c.coach_name}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm(`Remove ${c.coach_name}?`)) remove.mutate(c.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type AttrKey = "speed" | "strength" | "repeatability";
type PendingAttr = {
  playerId: string;
  playerName: string;
  attribute: AttrKey;
  attributeLabel: string;
  oldValue: number | null;
  newValue: number;
};

function AttributesSection() {
  const qc = useQueryClient();
  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => listPlayers(),
  });
  const [pending, setPending] = useState<PendingAttr | null>(null);

  const update = useMutation({
    mutationFn: (v: { id: string; attribute: AttrKey; value: number }) =>
      updatePlayerAttribute({ data: v }),
    onSuccess: () => {
      toast.success("Attribute updated");
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
      setPending(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Attributes</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Confirmation required
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Physical / conditioning measures. Each change is confirmed and audited.
      </p>
      <ul className="space-y-3">
        {players.map((p: any) => (
          <li key={p.id} className="rounded-md border bg-background p-3">
            <p className="mb-2 text-sm font-medium">{p.player_name}</p>
            <div className="space-y-2">
              {ATTRIBUTES.map((a) => {
                const current = p[a.key] as number | undefined;
                return (
                  <div key={a.key} className="flex items-center justify-between gap-2">
                    <span className="w-28 text-xs text-muted-foreground">{a.label}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const active = current === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              if (active) return;
                              setPending({
                                playerId: p.id,
                                playerName: p.player_name,
                                attribute: a.key as AttrKey,
                                attributeLabel: a.label,
                                oldValue: current ?? null,
                                newValue: n,
                              });
                            }}
                            className={`h-7 w-7 rounded-md border text-xs font-semibold transition ${
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-background hover:border-primary/50"
                            }`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm attribute change</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold">{pending?.playerName}</span> ·{" "}
                  {pending?.attributeLabel}
                </p>
                <p>
                  From{" "}
                  <span className="font-semibold">
                    {pending?.oldValue ?? "—"}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-primary">
                    {pending?.newValue}
                  </span>
                </p>
                {pending?.attribute === "repeatability" && pending && (
                  <p className="text-xs italic text-muted-foreground">
                    {REPEATABILITY_DESCRIPTORS[pending.newValue]}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  This change will be recorded in the audit log.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={update.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={update.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!pending) return;
                update.mutate({
                  id: pending.playerId,
                  attribute: pending.attribute,
                  value: pending.newValue,
                });
              }}
            >
              {update.isPending ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AuditLogSection() {
  const { data: rows = [] } = useQuery({
    queryKey: ["audit-log"],
    queryFn: () => listAuditLog({ data: { limit: 50 } }),
  });

  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-1 text-sm font-semibold">Audit log</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Most recent 50 changes to permanent player records.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No audit entries yet.</p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-auto text-xs">
          {rows.map((r: any) => {
            const attr = r.metadata?.attribute as string | undefined;
            const playerName = r.metadata?.player_name as string | undefined;
            const oldV = attr ? r.old_values?.[attr] : null;
            const newV = attr ? r.new_values?.[attr] : null;
            return (
              <li
                key={r.id}
                className="rounded-md border bg-background px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    {playerName ?? r.table_name} · {attr ?? r.operation}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                {attr && (
                  <p className="mt-0.5 text-muted-foreground">
                    {oldV ?? "—"} → <span className="font-semibold text-primary">{newV}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
