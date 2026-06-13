import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import {
  listAllSessions,
  listBlocks,
  createSession,
  updateSession,
  deleteSession,
} from "@/lib/sessions/sessions.functions";
import { getMyRole } from "@/lib/auth/roles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

const BLOCK_COLORS = [
  "#003087", // navy
  "#FFB81C", // gold
  "#2E7D32", // green
  "#C62828", // red
  "#6A1B9A", // purple
  "#00838F", // teal
  "#EF6C00", // orange
  "#455A64", // slate
];

function blockColor(n: number | null | undefined) {
  if (n == null) return "#888";
  return BLOCK_COLORS[(n - 1) % BLOCK_COLORS.length];
}

type Session = Awaited<ReturnType<typeof listAllSessions>>[number];

function startOfWeekMon(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun..6 Sat
  const diff = (day + 6) % 7; // days since Monday
  x.setDate(x.getDate() - diff);
  return x;
}

function fmtDay(date: string) {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function CalendarPage() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMyRole() });
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["all-sessions"],
    queryFn: () => listAllSessions(),
  });

  const [editing, setEditing] = useState<Session | null>(null);
  const [creating, setCreating] = useState(false);

  // Group sessions by (block_id, week start)
  const grouped = useMemo(() => {
    type WeekRow = {
      key: string;
      block_id: string;
      block_name: string;
      block_number: number | null;
      weekStart: Date;
      wed: Session | null;
      sun: Session | null;
    };
    const map = new Map<string, WeekRow>();
    for (const s of sessions) {
      const d = new Date(s.session_date + "T00:00:00");
      const ws = startOfWeekMon(d);
      const key = `${s.block_id}|${ws.toISOString().slice(0, 10)}`;
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          block_id: s.block_id,
          block_name: s.block_name,
          block_number: s.block_number,
          weekStart: ws,
          wed: null,
          sun: null,
        };
        map.set(key, row);
      }
      const dow = d.getDay();
      if (dow === 0) row.sun = s; // Sunday
      else if (dow === 3) row.wed = s; // Wednesday
      else {
        // Non-Wed/Sun: put on whichever slot is empty (treat as Wed pref)
        if (!row.wed) row.wed = s;
        else if (!row.sun) row.sun = s;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => a.weekStart.getTime() - b.weekStart.getTime(),
    );
  }, [sessions]);

  // Group rows by block for sectioned display
  const byBlock = useMemo(() => {
    const m = new Map<string, { block_name: string; block_number: number | null; rows: typeof grouped }>();
    for (const r of grouped) {
      let b = m.get(r.block_id);
      if (!b) {
        b = { block_name: r.block_name, block_number: r.block_number, rows: [] };
        m.set(r.block_id, b);
      }
      b.rows.push(r);
    }
    return Array.from(m.entries()).map(([block_id, v]) => ({ block_id, ...v }));
  }, [grouped]);

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Season</p>
          <h1 className="mt-1 text-2xl font-bold text-primary">Calendar</h1>
        </div>
        {me?.isBlockBuilder && (
          <Button onClick={() => setCreating(true)} size="sm">
            <Plus className="h-4 w-4" /> Add Session
          </Button>
        )}
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && !sessions.length && (
        <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          No sessions scheduled yet.
        </p>
      )}

      <div className="space-y-8">
        {byBlock.map((b) => {
          const color = blockColor(b.block_number);
          return (
            <section key={b.block_id}>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color }}>
                  {b.block_name}
                </h2>
              </div>
              <ul className="space-y-3">
                {b.rows.map((r) => (
                  <li
                    key={r.key}
                    className="rounded-lg border bg-card overflow-hidden"
                    style={{ borderLeft: `4px solid ${color}` }}
                  >
                    <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                      Week of{" "}
                      {r.weekStart.toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border/40">
                      <SessionSlot
                        label="Wed"
                        session={r.wed}
                        color={color}
                        canEdit={!!me?.isBlockBuilder}
                        onEdit={(s) => setEditing(s)}
                      />
                      <SessionSlot
                        label="Sun"
                        session={r.sun}
                        color={color}
                        canEdit={!!me?.isBlockBuilder}
                        onEdit={(s) => setEditing(s)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="h-24" />

      {creating && (
        <SessionDialog
          open={creating}
          onClose={() => setCreating(false)}
          session={null}
        />
      )}
      {editing && (
        <SessionDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          session={editing}
        />
      )}
    </main>
  );
}

function SessionSlot({
  label,
  session,
  color,
  canEdit,
  onEdit,
}: {
  label: string;
  session: Session | null;
  color: string;
  canEdit: boolean;
  onEdit: (s: Session) => void;
}) {
  const navigate = useNavigate();

  if (!session) {
    return (
      <div className="bg-card p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {label}
        </div>
        <p className="mt-1 text-sm text-muted-foreground/60">—</p>
      </div>
    );
  }

  const isMatch = session.session_type === "match";
  const sessionDate = new Date(session.session_date + "T00:00:00");
  const isPast = sessionDate.getTime() < new Date().setHours(0, 0, 0, 0);

  const handleClick = () => {
    if (isMatch) {
      if (isPast) {
        navigate({ to: "/match-summary/$sessionId", params: { sessionId: session.id } });
      } else {
        navigate({ to: "/match-day", search: { sessionId: session.id } });
      }
    } else {
      navigate({ to: "/session-info/$sessionId", params: { sessionId: session.id } });
    }
  };

  return (
    <div className="relative bg-card group">
      <button
        onClick={handleClick}
        className="block w-full p-4 text-left transition hover:bg-accent/5"
      >
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label} • {fmtDay(session.session_date)}
          </div>
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: color }}
          >
            {isMatch ? "Match" : "Training"}
          </span>
        </div>
        {isMatch && (session.opponent || session.venue) && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="font-semibold text-primary">
              vs {session.opponent || "TBC"}
            </span>
            {session.venue && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {session.venue}
              </span>
            )}
          </div>
        )}
      </button>
      {canEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(session);
          }}
          className="absolute right-2 top-2 rounded p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-muted"
          aria-label="Edit session"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function SessionDialog({
  open,
  onClose,
  session,
}: {
  open: boolean;
  onClose: () => void;
  session: Session | null;
}) {
  const qc = useQueryClient();
  const { data: blocks = [] } = useQuery({ queryKey: ["blocks"], queryFn: () => listBlocks() });

  const [blockId, setBlockId] = useState(session?.block_id ?? "");
  const [date, setDate] = useState(session?.session_date ?? "");
  const [type, setType] = useState<"training" | "match">(session?.session_type ?? "match");
  const [opponent, setOpponent] = useState(session?.opponent ?? "");
  const [venue, setVenue] = useState<"Home" | "Away" | "">(
    (session?.venue as any) ?? "",
  );
  const [weekNumber, setWeekNumber] = useState<string>(
    session?.week_number ? String(session.week_number) : "",
  );

  useEffect(() => {
    // auto-calc week number from block start_date when blank
    if (!weekNumber && date && blockId) {
      const b: any = blocks.find((x: any) => x.id === blockId);
      if (b?.start_date) {
        const start = new Date(b.start_date + "T00:00:00");
        const d = new Date(date + "T00:00:00");
        const diffDays = Math.floor((d.getTime() - start.getTime()) / 86400000);
        if (diffDays >= 0) setWeekNumber(String(Math.floor(diffDays / 7) + 1));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, blockId, blocks]);

  const create = useMutation({
    mutationFn: () =>
      createSession({
        data: {
          block_id: blockId,
          session_date: date,
          session_type: type,
          week_number: weekNumber ? Number(weekNumber) : null,
          opponent: type === "match" ? opponent || null : null,
          venue: type === "match" ? venue || null : null,
        },
      }),
    onSuccess: () => {
      toast.success("Session added");
      qc.invalidateQueries({ queryKey: ["all-sessions"] });
      qc.invalidateQueries({ queryKey: ["match-sessions"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: () =>
      updateSession({
        data: {
          id: session!.id,
          block_id: blockId,
          session_date: date,
          session_type: type,
          week_number: weekNumber ? Number(weekNumber) : null,
          opponent: type === "match" ? opponent || null : null,
          venue: type === "match" ? venue || null : null,
        },
      }),
    onSuccess: () => {
      toast.success("Session updated");
      qc.invalidateQueries({ queryKey: ["all-sessions"] });
      qc.invalidateQueries({ queryKey: ["match-sessions"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => deleteSession({ data: { id: session!.id } }),
    onSuccess: () => {
      toast.success("Session deleted");
      qc.invalidateQueries({ queryKey: ["all-sessions"] });
      qc.invalidateQueries({ queryKey: ["match-sessions"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockId || !date) return;
    if (session) update.mutate();
    else create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{session ? "Edit session" : "Add session"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="match">Match</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Block</Label>
            <Select value={blockId} onValueChange={setBlockId}>
              <SelectTrigger>
                <SelectValue placeholder="Select block" />
              </SelectTrigger>
              <SelectContent>
                {blocks.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name ?? `Block ${b.block_number}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Week number</Label>
            <Input
              type="number"
              min={1}
              value={weekNumber}
              onChange={(e) => setWeekNumber(e.target.value)}
              placeholder="Auto"
            />
          </div>
          {type === "match" && (
            <>
              <div className="space-y-2">
                <Label>Opponent</Label>
                <Input
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  placeholder="Team name"
                />
              </div>
              <div className="space-y-2">
                <Label>Venue</Label>
                <div className="flex gap-2">
                  {(["Home", "Away"] as const).map((v) => (
                    <Button
                      key={v}
                      type="button"
                      variant={venue === v ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVenue(v)}
                    >
                      {v}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            {session && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (confirm("Delete this session?")) del.mutate();
                }}
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {session ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
