import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { getMyRole } from "@/lib/auth/roles.functions";
import {
  listPlayers,
  addPlayer,
  removePlayer,
  updatePlayerAttribute,
  listAuditLog,
  bulkAddPlayers,
  deactivatePlayer,
  renamePlayer,
} from "@/lib/players/players.functions";
import { listCoaches, addCoach, removeCoach } from "@/lib/coaches/coaches.functions";
import { inviteUser } from "@/lib/admin/invite.functions";
import { listBlocks, createSession } from "@/lib/sessions/sessions.functions";
import { ATTRIBUTES, SKILLS } from "@/lib/skills";
import { listMatchWeeks, getWeekCompletion } from "@/lib/skill-ratings/skill-ratings.functions";
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
import { Trash2, Pencil, UserX, RotateCcw, ListPlus, X, ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { qk } from "@/lib/query-keys";
import { useConfirm } from "@/components/confirm-dialog";
import { QueryError } from "@/components/query-error";
import { Switch } from "@/components/ui/switch";
import { setViewAsCoach, useMyRole } from "@/lib/auth/view-as";

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
  const { viewAsCoach } = useMyRole();
  return (
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-32">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-primary">Manage</h1>
        <div className="mt-3 flex items-center justify-between rounded-lg border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-semibold">View as coach</p>
            <p className="text-xs text-muted-foreground">
              Preview the app without admin tools
            </p>
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

function SessionsSection() {
  const qc = useQueryClient();
  const { data: blocks = [] } = useQuery({ queryKey: qk.blocks.all, queryFn: () => listBlocks() });
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
      qc.invalidateQueries({ queryKey: qk.sessions.matchList });
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
  const { data: coaches = [] } = useQuery({ queryKey: qk.coaches.all, queryFn: () => listCoaches() });
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
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: players = [], isLoading, isError, refetch } = useQuery({ queryKey: qk.players.all, queryFn: () => listPlayers() });
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.players.all });

  const add = useMutation({
    mutationFn: () => addPlayer({ data: { player_name: name } }),
    onSuccess: () => {
      setName("");
      invalidate();
      toast.success("Player added");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removePlayer({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Player removed");
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (/foreign key|violates/i.test(msg)) {
        toast.error("This player has ratings history — deactivate them instead to keep records intact.");
      } else {
        toast.error(msg || "Failed to remove player");
      }
    },
  });
  const bulkAdd = useMutation({
    mutationFn: (names: string[]) => bulkAddPlayers({ data: { names } }),
    onSuccess: (r: any) => {
      setBulkText("");
      setBulkOpen(false);
      invalidate();
      toast.success(
        r.added > 0
          ? `Added ${r.added} player${r.added === 1 ? "" : "s"}${r.skipped ? `, skipped ${r.skipped} duplicate${r.skipped === 1 ? "" : "s"}` : ""}`
          : `No new players added — ${r.skipped} duplicate${r.skipped === 1 ? "" : "s"} skipped`,
      );
    },
    onError: (e: any) => toast.error(e.message),
  });
  const toggleActive = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      deactivatePlayer({ data: { id: v.id, active: v.active } }),
    onSuccess: (_r, v) => {
      invalidate();
      toast.success(v.active ? "Player reactivated" : "Player deactivated");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const rename = useMutation({
    mutationFn: (v: { id: string; player_name: string }) =>
      renamePlayer({ data: v }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast.success("Player renamed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isError) {
    return (
      <div className="rounded-lg border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">Players</h3>
        <p className="text-sm text-muted-foreground">
          Couldn't load players.{" "}
          <button className="text-primary underline" onClick={() => refetch()}>
            Try again
          </button>
        </p>
      </div>
    );
  }

  // Treat missing is_active field as active (safe before migration lands)
  const isActive = (p: any) => p.is_active !== false;
  const activeCount = players.filter(isActive).length;
  const inactiveCount = players.length - activeCount;

  const filtered = players
    .filter((p: any) => (showInactive ? !isActive(p) : isActive(p)))
    .filter((p: any) =>
      search.trim()
        ? p.player_name.toLowerCase().includes(search.trim().toLowerCase())
        : true,
    );

  const bulkNames = bulkText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const handleDelete = async (p: any) => {
    const ok = await confirm({
      title: `Remove ${p.player_name}?`,
      description:
        "This permanently deletes the player. If they have ratings history, use Deactivate instead to keep records intact.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) remove.mutate(p.id);
  };

  const handleToggle = async (p: any) => {
    const making = isActive(p) ? "deactivat" : "reactivat";
    const ok = await confirm({
      title: `${making === "deactivat" ? "Deactivate" : "Reactivate"} ${p.player_name}?`,
      description: making === "deactivat"
        ? "Deactivating keeps all their ratings and history but hides them from squad lists and group assignment."
        : "Reactivating makes the player visible in squad lists and available for group assignment again.",
      confirmLabel: making === "deactivat" ? "Deactivate" : "Reactivate",
      destructive: making === "deactivat",
    });
    if (ok) toggleActive.mutate({ id: p.id, active: !isActive(p) });
  };

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Players ({activeCount} active{inactiveCount ? `, ${inactiveCount} inactive` : ""})
        </h3>
        <Button
          type="button"
          size="sm"
          variant={bulkOpen ? "secondary" : "outline"}
          onClick={() => {
            setBulkOpen((v) => !v);
            if (!bulkOpen) setBulkText("");
          }}
        >
          <ListPlus className="h-4 w-4" /> Bulk add
        </Button>
      </div>

      {bulkOpen && (
        <div className="mb-4 space-y-2 rounded-md border bg-muted/30 p-3">
          <Textarea
            autoFocus
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"Paste player names, one per line…\nJohnny Smith\nAlex Jones\nSam Taylor"}
            rows={6}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {bulkNames.length} name{bulkNames.length === 1 ? "" : "s"} ready (duplicates are skipped)
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setBulkOpen(false);
                  setBulkText("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={bulkAdd.isPending || bulkNames.length === 0}
                onClick={() => bulkAdd.mutate(bulkNames)}
              >
                {bulkAdd.isPending ? "Adding…" : `Add ${bulkNames.length || ""} player${bulkNames.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        </div>
      )}

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
        <Button type="submit" disabled={add.isPending}>
          Add
        </Button>
      </form>

      <div className="mb-3 flex items-center gap-2">
        <Input
          placeholder="Search players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
        {inactiveCount > 0 && (
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
              showInactive
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:border-primary/40"
            }`}
          >
            {showInactive ? "Inactive" : "Active"} ({showInactive ? inactiveCount : activeCount})
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search.trim() ? "No players match your search." : showInactive ? "No inactive players." : "No active players."}
        </p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-auto">
          {filtered.map((p: any) => (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded-md px-3 py-2 hover:bg-secondary ${isActive(p) ? "" : "opacity-70"}`}
            >
              {editingId === p.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editName.trim()) rename.mutate({ id: p.id, player_name: editName });
                  }}
                >
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8"
                  />
                  <Button type="submit" size="sm" disabled={rename.isPending || !editName.trim()}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                    aria-label="Cancel rename"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {p.player_name}
                    {!isActive(p) && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Rename ${p.player_name}`}
                      onClick={() => {
                        setEditingId(p.id);
                        setEditName(p.player_name);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={isActive(p) ? `Deactivate ${p.player_name}` : `Reactivate ${p.player_name}`}
                      onClick={() => handleToggle(p)}
                    >
                      {isActive(p) ? (
                        <UserX className="h-4 w-4 text-amber-600" />
                      ) : (
                        <RotateCcw className="h-4 w-4 text-emerald-600" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${p.player_name}`}
                      onClick={() => handleDelete(p)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {confirmDialog}
    </div>
  );
}

function CoachesSection() {
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: coaches = [] } = useQuery({ queryKey: qk.coaches.all, queryFn: () => listCoaches() });
  const [name, setName] = useState("");

  const add = useMutation({
    mutationFn: () => addCoach({ data: { coach_name: name } }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: qk.coaches.all });
      toast.success("Coach added");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeCoach({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.coaches.all }),
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
        <Button type="submit" disabled={add.isPending}>
          Add
        </Button>
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
              onClick={async () => {
                const ok = await confirm({ title: `Remove ${c.coach_name}?`, description: "This coach will be removed.", confirmLabel: "Remove", destructive: true });
                if (ok) remove.mutate(c.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
      {confirmDialog}
    </div>
  );
}

type AttrKey =
  | "speed"
  | "strength"
  | "repeatability"
  | "carrying"
  | "handling"
  | "tackling"
  | "rucking"
  | "kicking"
  | "catching"
  | "iq";
type PendingAttr = {
  playerId: string;
  playerName: string;
  attribute: AttrKey;
  attributeLabel: string;
  oldValue: number;
  newValue: number;
};

function AttributesSection() {
  const qc = useQueryClient();
  const { data: players = [] } = useQuery({
    queryKey: qk.players.all,
    queryFn: () => listPlayers(),
  });
  const [pendingChanges, setPendingChanges] = useState<PendingAttr[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const update = useMutation({
    mutationFn: (v: { id: string; attribute: AttrKey; value: number }) =>
      updatePlayerAttribute({ data: v }),
    onError: (e: any) => toast.error(e.message),
  });

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const pendingCountFor = (id: string) =>
    pendingChanges.filter((c) => c.playerId === id).length;

  const renderRow = (p: any, def: { key: string; label: string }) => {
    const current = (p[def.key] as number | undefined) ?? 0;
    const pendingChange = pendingChanges.find(
      (c) => c.playerId === p.id && c.attribute === (def.key as AttrKey),
    );
    const displayValue = pendingChange?.newValue ?? current;
    const isChanged = !!pendingChange;
    return (
      <div key={def.key} className="flex items-center justify-between gap-2">
        <span className="w-24 text-xs text-muted-foreground">{def.label}</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = displayValue === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setPendingChanges((prev) => {
                    const filtered = prev.filter(
                      (c) => !(c.playerId === p.id && c.attribute === (def.key as AttrKey)),
                    );
                    if (current === n) return filtered;
                    return [
                      ...filtered,
                      {
                        playerId: p.id,
                        playerName: p.player_name,
                        attribute: def.key as AttrKey,
                        attributeLabel: def.label,
                        oldValue: current,
                        newValue: n,
                      },
                    ];
                  });
                }}
                className={`h-7 w-7 rounded-md border text-xs font-semibold transition ${
                  active
                    ? isChanged
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-primary bg-primary text-primary-foreground"
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
  };

  const confirmAll = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      for (const change of pendingChanges) {
        await update.mutateAsync({
          id: change.playerId,
          attribute: change.attribute,
          value: change.newValue,
        });
      }
      toast.success(
        `${pendingChanges.length} baseline change${pendingChanges.length === 1 ? "" : "s"} saved`,
      );
      setPendingChanges([]);
      setShowReview(false);
      qc.invalidateQueries({ queryKey: qk.players.all });
      qc.invalidateQueries({ queryKey: qk.auditLog });
    } catch {
      toast.error("Some changes failed to save");
      qc.invalidateQueries({ queryKey: qk.players.all });
      qc.invalidateQueries({ queryKey: qk.auditLog });
    }
  };

  const filteredPlayers = search.trim()
    ? players.filter((p: any) =>
        p.player_name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : players;

  const allExpanded = filteredPlayers.length > 0 && filteredPlayers.every((p: any) => expandedIds.includes(p.id));

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Baselines</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Batch confirmation
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Tap a player to edit their baseline skills and attributes. Review and confirm all changes at once — every saved change is audited.
      </p>

      <div className="mb-3 flex items-center gap-2">
        <Input
          placeholder="Search players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setExpandedIds(allExpanded ? [] : filteredPlayers.map((p: any) => p.id))
          }
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
          {allExpanded ? "Collapse all" : "Expand all"}
        </Button>
      </div>

      <ul className="space-y-1">
        {filteredPlayers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {search.trim() ? "No players match your search." : "No players yet."}
          </p>
        )}
        {filteredPlayers.map((p: any) => {
          const expanded = expandedIds.includes(p.id);
          const pendingCount = pendingCountFor(p.id);
          return (
            <li key={p.id} className="overflow-hidden rounded-md border bg-background">
              <button
                type="button"
                onClick={() => toggleExpanded(p.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-secondary"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{p.player_name}</span>
                  {pendingCount > 0 && (
                    <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {pendingCount}
                    </span>
                  )}
                </span>
                {expanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              {expanded && (
                <div className="border-t px-3 py-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Skills
                  </p>
                  <div className="space-y-2">{SKILLS.map((s) => renderRow(p, s))}</div>

                  <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Attributes
                  </p>
                  <div className="space-y-2">{ATTRIBUTES.map((a) => renderRow(p, a))}</div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {pendingChanges.length > 0 && (
        <div className="fixed bottom-20 left-1/2 z-40 w-[min(95vw,640px)] -translate-x-1/2 rounded-xl border border-amber-500 bg-card p-3 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">
              {pendingChanges.length} change{pendingChanges.length === 1 ? "" : "s"} pending
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPendingChanges([])}>
                Discard
              </Button>
              <Button size="sm" onClick={() => setShowReview(true)}>
                Review
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={showReview} onOpenChange={(o) => !update.isPending && setShowReview(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm baseline changes</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  The following {pendingChanges.length} change
                  {pendingChanges.length === 1 ? "" : "s"} will be saved and recorded in the audit
                  log:
                </p>
                <ul className="max-h-60 space-y-1 overflow-auto rounded border bg-background p-2">
                  {pendingChanges.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium">{c.playerName}</span>
                      <span className="text-muted-foreground">
                        {c.attributeLabel}:{" "}
                        <span className="font-semibold">{c.oldValue || "—"}</span>
                        {" → "}
                        <span className="font-semibold text-primary">{c.newValue}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={update.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={update.isPending} onClick={confirmAll}>
              {update.isPending
                ? "Saving…"
                : `Confirm ${pendingChanges.length} change${pendingChanges.length === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function CompletionTrackerSection() {
  const { data: weeks, isError: weeksError, refetch: refetchWeeks } = useQuery({
    queryKey: qk.sessions.matchWeeks,
    queryFn: () => listMatchWeeks(),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const activeId = selected ?? weeks?.weeks?.[0]?.id ?? null;
  const { data: tracker } = useQuery({
    queryKey: qk.sessions.weekCompletion.detail(activeId),
    queryFn: () => getWeekCompletion({ data: { session_id: activeId! } }),
    enabled: !!activeId,
  });
  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-1 text-sm font-semibold">Weekly rating completion</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Per-group status for a selected match week.
      </p>
      {weeksError ? (
        <QueryError message="Couldn't load match weeks" onRetry={() => refetchWeeks()} />
      ) : weeks?.weeks?.length ? (
        <select
          value={activeId ?? ""}
          onChange={(e) => setSelected(e.target.value)}
          className="mb-4 w-full rounded-md border bg-background px-2 py-1 text-sm"
        >
          {weeks.weeks.map((w: any) => (
            <option key={w.id} value={w.id}>
              Week {w.week_number ?? "—"} · {w.session_date}
              {w.opponent ? ` · ${w.opponent}` : ""}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-xs text-muted-foreground">No match weeks yet.</p>
      )}
      {tracker && (
        <ul className="space-y-2">
          {tracker.groups.map((g: any) => {
            const palette =
              g.status === "submitted"
                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                : g.status === "partial"
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-slate-100 text-slate-700 border-slate-300";
            const label =
              g.status === "submitted"
                ? "Submitted"
                : g.status === "partial"
                  ? `Partial (${g.rated}/${g.expected})`
                  : "Not started";
            return (
              <li
                key={g.group_id}
                className="rounded-md border bg-background p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Group {g.group_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.coaches.length ? g.coaches.join(", ") : "No coaches"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${palette}`}
                  >
                    {label}
                  </span>
                </div>
                {(g.status === "submitted" || g.status === "partial") && activeId && (
                  <Link
                    to="/match-summary/$sessionId"
                    params={{ sessionId: activeId }}
                    className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                  >
                    View ratings →
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AuditLogSection() {
  const { data: rows = [], isError: logError, refetch: refetchLog } = useQuery({
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
                  <span className="text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
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
