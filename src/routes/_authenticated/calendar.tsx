import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  listAllSessions,
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
import { formatDateLong } from "@/lib/dates";
import { qk } from "@/lib/query-keys";
import { useConfirm } from "@/components/confirm-dialog";
import { QueryError } from "@/components/query-error";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

type SessionRow = {
  id: string;
  session_date: string;
  session_type: "training" | "match";
  opponent: string | null;
  venue: string | null;
};

function CalendarPage() {
  const { data: me } = useMyRole();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SessionRow | null>(null);

  const {
    data: sessions = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: qk.sessions.list,
    queryFn: () => listAllSessions(),
  });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(
    () => (sessions as SessionRow[]).filter((s) => s.session_date >= today),
    [sessions, today],
  );
  const past = useMemo(
    () => (sessions as SessionRow[]).filter((s) => s.session_date < today),
    [sessions, today],
  );

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-32">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Season</p>
          <h1 className="mt-1 text-2xl font-bold text-primary">Calendar</h1>
        </div>
        {me?.isAdmin && (
          <Button onClick={() => setCreating(true)} size="sm" variant="outline">
            <Plus className="h-4 w-4" /> Add Session
          </Button>
        )}
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <QueryError message="Couldn't load sessions" onRetry={() => refetch()} />}

      {!isLoading && !isError && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
                Nothing scheduled.
              </p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((s) => (
                  <SessionRowItem
                    key={s.id}
                    session={s}
                    canEdit={!!me?.isAdmin}
                    onEdit={setEditing}
                  />
                ))}
              </ul>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Past</h2>
              <ul className="space-y-2">
                {past.map((s) => (
                  <SessionRowItem
                    key={s.id}
                    session={s}
                    canEdit={!!me?.isAdmin}
                    onEdit={setEditing}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {creating && (
        <SessionDialog open={creating} onClose={() => setCreating(false)} session={null} />
      )}
      {editing && (
        <SessionDialog open={!!editing} onClose={() => setEditing(null)} session={editing} />
      )}
    </main>
  );
}

function SessionRowItem({
  session,
  canEdit,
  onEdit,
}: {
  session: SessionRow;
  canEdit: boolean;
  onEdit: (s: SessionRow) => void;
}) {
  const navigate = useNavigate();
  const isMatch = session.session_type === "match";
  const sessionDate = new Date(session.session_date + "T00:00:00");
  const isPast = sessionDate.getTime() < new Date().setHours(0, 0, 0, 0);

  const handleClick = () => {
    if (isMatch) {
      if (isPast) {
        navigate({ to: "/match-summary/$sessionId", params: { sessionId: session.id } });
      } else {
        navigate({
          to: "/match-day",
          search: { sessionId: session.id, teamId: undefined, step: undefined },
        });
      }
    } else {
      navigate({ to: "/session-info/$sessionId", params: { sessionId: session.id } });
    }
  };

  return (
    <li className="relative rounded-lg border bg-card group">
      <button
        onClick={handleClick}
        className="block w-full p-4 text-left transition hover:bg-accent/5"
      >
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {formatDateLong(session.session_date)}
          </div>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${
              isMatch ? "bg-accent" : "bg-primary"
            }`}
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
          className="absolute right-2 top-2 rounded p-1.5 text-muted-foreground opacity-100 transition md:opacity-0 md:group-hover:opacity-100 hover:bg-muted"
          aria-label="Edit session"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

function SessionDialog({
  open,
  onClose,
  session,
}: {
  open: boolean;
  onClose: () => void;
  session: SessionRow | null;
}) {
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [date, setDate] = useState(session?.session_date ?? "");
  const [type, setType] = useState<"training" | "match">(session?.session_type ?? "match");
  const [opponent, setOpponent] = useState(session?.opponent ?? "");
  const [venue, setVenue] = useState<"Home" | "Away" | "">((session?.venue as any) ?? "");

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: qk.sessions.list });
    qc.invalidateQueries({ queryKey: qk.sessions.matchList });
  };

  const create = useMutation({
    mutationFn: () =>
      createSession({
        data: {
          session_date: date,
          session_type: type,
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
          session_date: date,
          session_type: type,
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
    if (!date) return;
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
          {type === "match" && (
            <>
              <div className="space-y-2">
                <Label>Opponent</Label>
                <Input
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  placeholder="Team name"
                  required
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
            <Button
              type="submit"
              disabled={
                create.isPending ||
                update.isPending ||
                (type === "match" && (!opponent.trim() || !venue))
              }
            >
              {session ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {confirmDialog}
    </Dialog>
  );
}
