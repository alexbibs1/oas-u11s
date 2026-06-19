import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getMyRole } from "@/lib/auth/roles.functions";
import {
  listPlayers,
  addPlayer,
  removePlayer,
  updatePlayerAttribute,
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
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const me = await getMyRole();
    if (!me.isBlockBuilder) throw redirect({ to: "/home" });
  },
  component: AdminPage,
});

function AdminPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pt-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-primary">Manage</h1>
      </header>

      <Link
        to="/block-builder"
        className="mb-6 flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-secondary"
      >
        <div>
          <p className="text-sm font-semibold">Block Builder</p>
          <p className="text-xs text-muted-foreground">
            Configure blocks, groups and assignments
          </p>
        </div>
        <span className="text-xs text-muted-foreground">Open →</span>
      </Link>

      <div className="space-y-8">
        <InviteSection />
        <SessionsSection />
        <AttributesSection />
        <PlayersSection />
        <CoachesSection />
      </div>
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
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold">Create session</h2>
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
    </section>
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
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold">Invite user</h2>
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
    </section>
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
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold">Players ({players.length})</h2>
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
    </section>
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
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold">Coaches ({coaches.length})</h2>
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
    </section>
  );
}

function AttributesSection() {
  const qc = useQueryClient();
  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => listPlayers(),
  });
  const [openDescriptor, setOpenDescriptor] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: (v: { id: string; attribute: "speed" | "strength" | "repeatability"; value: number }) =>
      updatePlayerAttribute({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["players"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Attributes</h2>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Updated infrequently
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Physical / conditioning measures. Saved instantly.
      </p>
      <ul className="space-y-3">
        {players.map((p: any) => (
          <li key={p.id} className="rounded-md border bg-background p-3">
            <p className="mb-2 text-sm font-medium">{p.player_name}</p>
            <div className="space-y-2">
              {ATTRIBUTES.map((a) => {
                const current = p[a.key] as number | undefined;
                const descId = `${p.id}-${a.key}`;
                const showDescriptor =
                  a.key === "repeatability" && openDescriptor?.startsWith(`${descId}-`);
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
                              update.mutate({ id: p.id, attribute: a.key as any, value: n });
                              if (a.key === "repeatability") {
                                const id = `${descId}-${n}`;
                                setOpenDescriptor(id);
                                setTimeout(
                                  () =>
                                    setOpenDescriptor((cur) =>
                                      cur === id ? null : cur,
                                    ),
                                  2200,
                                );
                              }
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
              {openDescriptor?.startsWith(`${p.id}-repeatability-`) && (
                <p className="text-right text-[11px] italic text-accent">
                  {
                    REPEATABILITY_DESCRIPTORS[
                      Number(openDescriptor.split("-").pop())
                    ]
                  }
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
