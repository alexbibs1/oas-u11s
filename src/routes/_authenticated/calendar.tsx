import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import {
  listBlocks,
  getBlockSlots,
  createSession,
  updateSession,
  deleteSession,
} from "@/lib/sessions/sessions.functions";
import { useMyRole } from "@/lib/auth/view-as";
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
import { formatDateShort } from "@/lib/dates";
import { qk } from "@/lib/query-keys";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

const BLOCK_COLORS = [
  "#003087",
  "#FFB81C",
  "#2E7D32",
  "#C62828",
  "#6A1B9A",
  "#00838F",
  "#EF6C00",
  "#455A64",
];

function blockColor(n: number | null | undefined) {
  if (n == null) return "#888";
  return BLOCK_COLORS[(n - 1) % BLOCK_COLORS.length];
}

type SlotSession = {
  id: string;
  session_date: string;
  session_type: "training" | "match";
  week_number: number | null;
  block_id: string;
  opponent: string | null;
  venue: string | null;
};

type Slot = {
  date: string;
  dayOfWeek: number;
  session: SlotSession | null;
};

function CalendarPage() {
  const { data: me } = useMyRole();
  const { data: blocks = [], isLoading: blocksLoading } = useQuery({
    queryKey: qk.blocks.all,
    queryFn: () => listBlocks(),
  });

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SlotSession | null>(null);
  const [creating, setCreating] = useState(false);

  // Default to active block
  useEffect(() => {
    if (!selectedBlockId && blocks.length) {
      const active = (blocks as any[]).find((b) => b.is_active);
      setSelectedBlockId(active?.id ?? blocks[0].id);
    }
  }, [blocks, selectedBlockId]);

  const currentBlock: any = useMemo(
    () => (blocks as any[]).find((b) => b.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId],
  );

  const { data: blockData, isLoading: slotsLoading } = useQuery({
    queryKey: selectedBlockId ? qk.sessions.blockSlots(selectedBlockId) : ["block-slots", "none"],
    queryFn: () => getBlockSlots({ data: { block_id: selectedBlockId! } }),
    enabled: !!selectedBlockId,
  });

  const color = blockColor(currentBlock?.block_number);

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Season</p>
          <h1 className="mt-1 text-2xl font-bold text-primary">Calendar</h1>
        </div>
        {me?.isBlockBuilder && (
          <Button onClick={() => setCreating(true)} size="sm" variant="outline">
            <Plus className="h-4 w-4" /> Add Session
          </Button>
        )}
      </header>

      {blocks.length > 0 && (
        <div className="mb-5">
          <Select value={selectedBlockId ?? ""} onValueChange={setSelectedBlockId}>
            <SelectTrigger>
              <SelectValue placeholder="Select block" />
            </SelectTrigger>
            <SelectContent>
              {(blocks as any[]).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name ?? `Block ${b.block_number}`}
                  {b.is_active ? " (Active)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(blocksLoading || slotsLoading) && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {!blocksLoading && !blocks.length && (
        <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          No blocks yet.
        </p>
      )}

      {currentBlock && blockData && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color }}>
              {currentBlock.name ?? `Block ${currentBlock.block_number}`}
            </h2>
          </div>

          {blockData.weeks.length === 0 && (
            <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
              This block has no date range set.
            </p>
          )}

          <ul className="space-y-3">
            {blockData.weeks.map((w: any) => {
              const wsDate = new Date(w.weekStart + "T00:00:00");
              const wed = (w.items as Slot[]).find((i) => i.dayOfWeek === 3) ?? null;
              const sun = (w.items as Slot[]).find((i) => i.dayOfWeek === 0) ?? null;
              const others = (w.items as Slot[]).filter(
                (i) => i.dayOfWeek !== 0 && i.dayOfWeek !== 3,
              );
              return (
                <li
                  key={w.weekStart}
                  className="rounded-lg border bg-card overflow-hidden"
                  style={{ borderLeft: `4px solid ${color}` }}
                >
                  <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Week of{" "}
                    {wsDate.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border/40">
                    <SlotCell
                      label="Wed"
                      slot={wed}
                      blockId={currentBlock.id}
                      color={color}
                      canEdit={!!me?.isBlockBuilder}
                      onEdit={(s) => setEditing(s)}
                    />
                    <SlotCell
                      label="Sun"
                      slot={sun}
                      blockId={currentBlock.id}
                      color={color}
                      canEdit={!!me?.isBlockBuilder}
                      onEdit={(s) => setEditing(s)}
                    />
                  </div>
                  {others.map((o) => (
                    <div key={o.date} className="border-t bg-card">
                      <SlotCell
                        label={new Date(o.date + "T00:00:00").toLocaleDateString(undefined, {
                          weekday: "short",
                        })}
                        slot={o}
                        blockId={currentBlock.id}
                        color={color}
                        canEdit={!!me?.isBlockBuilder}
                        onEdit={(s) => setEditing(s)}
                      />
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="h-24" />

      {creating && (
        <SessionDialog
          open={creating}
          onClose={() => setCreating(false)}
          session={null}
          defaultBlockId={selectedBlockId}
        />
      )}
      {editing && (
        <SessionDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          session={editing}
          defaultBlockId={editing.block_id}
        />
      )}
    </main>
  );
}

function SlotCell({
  label,
  slot,
  blockId,
  color,
  canEdit,
  onEdit,
}: {
  label: string;
  slot: Slot | null;
  blockId: string;
  color: string;
  canEdit: boolean;
  onEdit: (s: SlotSession) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [matchOpen, setMatchOpen] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [venue, setVenue] = useState<"Home" | "Away" | "">("");

  const quickCreate = useMutation({
    mutationFn: (payload: {
      type: "training" | "match";
      opponent?: string | null;
      venue?: string | null;
    }) =>
      createSession({
        data: {
          block_id: blockId,
          session_date: slot!.date,
          session_type: payload.type,
          week_number: null,
          opponent: payload.opponent ?? null,
          venue: payload.venue ?? null,
        },
      }),
    onSuccess: () => {
      toast.success("Session added");
      qc.invalidateQueries({ queryKey: qk.sessions.blockSlots(blockId) });
      qc.invalidateQueries({ queryKey: qk.sessions.list });
      qc.invalidateQueries({ queryKey: qk.sessions.matchList });
      setMatchOpen(false);
      setOpponent("");
      setVenue("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!slot) {
    return (
      <div className="bg-card p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {label}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">—</p>
      </div>
    );
  }

  if (!slot.session) {
    const isSunday = slot.dayOfWeek === 0;
    return (
      <div className="bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {formatDateShort(slot.date)}
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Not scheduled
          </span>
        </div>
        {canEdit ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={quickCreate.isPending}
              onClick={() => quickCreate.mutate({ type: "training" })}
            >
              + Training
            </Button>
            {isSunday && (
              <Button
                size="sm"
                variant="outline"
                disabled={quickCreate.isPending}
                onClick={() => setMatchOpen((v) => !v)}
              >
                + Match
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground/60">—</p>
        )}
        {matchOpen && (
          <div className="mt-3 space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="space-y-1">
              <Label className="text-xs">Opponent</Label>
              <Input
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder="Team name"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Venue</Label>
              <div className="flex gap-2">
                {(["Home", "Away"] as const).map((v) => (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    variant={venue === v ? "default" : "outline"}
                    onClick={() => setVenue(v)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setMatchOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={quickCreate.isPending || !opponent || !venue}
                onClick={() =>
                  quickCreate.mutate({ type: "match", opponent, venue })
                }
              >
                Save match
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const session = slot.session;
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
            {formatDateShort(session.session_date)}
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
            <span className="font-semibold text-primary">vs {session.opponent || "TBC"}</span>
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
  defaultBlockId,
}: {
  open: boolean;
  onClose: () => void;
  session: SlotSession | null;
  defaultBlockId: string | null;
}) {
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: blocks = [] } = useQuery({ queryKey: qk.blocks.all, queryFn: () => listBlocks() });

  const [blockId, setBlockId] = useState(session?.block_id ?? defaultBlockId ?? "");
  const [date, setDate] = useState(session?.session_date ?? "");
  const [type, setType] = useState<"training" | "match">(session?.session_type ?? "match");
  const [opponent, setOpponent] = useState(session?.opponent ?? "");
  const [venue, setVenue] = useState<"Home" | "Away" | "">((session?.venue as any) ?? "");

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: qk.sessions.list });
    qc.invalidateQueries({ queryKey: qk.sessions.matchList });
    if (blockId) qc.invalidateQueries({ queryKey: qk.sessions.blockSlots(blockId) });
    if (session?.block_id && session.block_id !== blockId)
      qc.invalidateQueries({ queryKey: qk.sessions.blockSlots(session.block_id) });
  };

  const create = useMutation({
    mutationFn: () =>
      createSession({
        data: {
          block_id: blockId,
          session_date: date,
          session_type: type,
          week_number: null,
          opponent: type === "match" ? opponent || null : null,
          venue: type === "match" ? venue || null : null,
        },
      }),
    onSuccess: () => {
      toast.success("Session added");
      invalidateAll();
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
          week_number: null,
          opponent: type === "match" ? opponent || null : null,
          venue: type === "match" ? venue || null : null,
        },
      }),
    onSuccess: () => {
      toast.success("Session updated");
      invalidateAll();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => deleteSession({ data: { id: session!.id } }),
    onSuccess: () => {
      toast.success("Session deleted");
      invalidateAll();
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
                {(blocks as any[]).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name ?? `Block ${b.block_number}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                onClick={async () => {
                  const ok = await confirm({
                    title: "Delete session?",
                    description: "This session will be permanently removed.",
                    confirmLabel: "Delete",
                    destructive: true,
                  });
                  if (ok) del.mutate();
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
      {confirmDialog}
    </Dialog>
  );
}
