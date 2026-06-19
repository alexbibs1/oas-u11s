import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getPlayer } from "@/lib/players/players.functions";
import {
  listPlayerNotes,
  createPlayerNote,
  updatePlayerNote,
  deletePlayerNote,
} from "@/lib/feed/feed.functions";
import { ChevronLeft, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const playerQuery = (id: string) => ({
  queryKey: ["player", id],
  queryFn: () => getPlayer({ data: { id } }),
});

export const Route = createFileRoute("/_authenticated/squad/$playerId")({
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(playerQuery(params.playerId));
    } catch {
      throw notFound();
    }
  },
  component: PlayerProfile,
});

import { SKILLS, ATTRIBUTES } from "@/lib/skills";

function PlayerProfile() {
  const { playerId } = Route.useParams();
  const { data: player } = useSuspenseQuery(playerQuery(playerId));
  const qc = useQueryClient();

  const listFn = useServerFn(listPlayerNotes);
  const createFn = useServerFn(createPlayerNote);
  const updateFn = useServerFn(updatePlayerNote);
  const deleteFn = useServerFn(deletePlayerNote);

  const { data: notes = [] } = useQuery({
    queryKey: ["player-notes", playerId],
    queryFn: () => listFn({ data: { player_id: playerId } }),
  });

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["player-notes", playerId] });
    qc.invalidateQueries({ queryKey: ["feed"] });
    qc.invalidateQueries({ queryKey: ["home-summary"] });
  };

  const addM = useMutation({
    mutationFn: (note: string) => createFn({ data: { player_id: playerId, note } }),
    onSuccess: () => { setDraft(""); setAdding(false); invalidate(); },
  });
  const updateM = useMutation({
    mutationFn: (v: { id: string; note: string }) => updateFn({ data: v }),
    onSuccess: () => { setEditingId(null); invalidate(); },
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: invalidate,
  });

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-32">
      <Link
        to="/squad"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Squad
      </Link>

      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Player</p>
        <h1 className="mt-1 text-3xl font-bold text-primary">{(player as any).player_name}</h1>
      </header>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Skills</h2>
        <div className="grid grid-cols-2 gap-3">
          {SKILLS.map((s) => {
            const value = (player as any)[s.key] as number;
            return (
              <div key={s.key} className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-primary">{value}</span>
                  <span className="text-xs text-muted-foreground">/ 5</span>
                </div>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={`h-1.5 flex-1 rounded-full ${
                        n <= value ? "bg-accent" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
          Attributes
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {ATTRIBUTES.map((a) => {
            const value = (player as any)[a.key] as number;
            return (
              <div
                key={a.key}
                className="rounded-md border border-dashed bg-card/60 p-3"
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {a.label}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground/90">
                  {value}
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">/ 5</span>
                </p>
              </div>
            );
          })}
        </div>
      </section>


      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Notes</h2>
          {!adding && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add Note
            </Button>
          )}
        </div>

        {adding && (
          <div className="mb-4 space-y-2 rounded-lg border bg-card p-4">
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a note about this player…"
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setDraft(""); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!draft.trim() || addM.isPending}
                onClick={() => addM.mutate(draft.trim())}
              >
                Save
              </Button>
            </div>
          </div>
        )}

        {notes.length === 0 && !adding && (
          <div className="rounded-lg border border-dashed bg-card/50 p-5 text-sm text-muted-foreground">
            No notes yet.
          </div>
        )}

        <ul className="space-y-3">
          {notes.map((n: any) => (
            <li key={n.id} className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">{n.coach_name ?? "Coach"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                {n.canEdit && editingId !== n.id && (
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setEditingId(n.id); setEditDraft(n.note); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { if (confirm("Delete this note?")) deleteM.mutate(n.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {editingId === n.id ? (
                <div className="space-y-2">
                  <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={4} />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!editDraft.trim() || updateM.isPending}
                      onClick={() => updateM.mutate({ id: n.id, note: editDraft.trim() })}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm">{n.note}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
