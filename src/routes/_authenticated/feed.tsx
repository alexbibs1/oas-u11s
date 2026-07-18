import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listFeed,
  createFeedPost,
  updateFeedPost,
  deleteFeedPost,
} from "@/lib/feed/feed.functions";
import { qk } from "@/lib/query-keys";
import { formatDateTime } from "@/lib/dates";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2, UserCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

function FeedPage() {
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const listFn = useServerFn(listFeed);
  const createFn = useServerFn(createFeedPost);
  const updateFn = useServerFn(updateFeedPost);
  const deleteFn = useServerFn(deleteFeedPost);

  const { data: posts = [] } = useQuery({
    queryKey: qk.feed.list,
    queryFn: () => listFn({ data: {} }),
  });

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.feed.all });

  const createM = useMutation({
    mutationFn: (content: string) => createFn({ data: { content } }),
    onSuccess: () => {
      setDraft("");
      setComposing(false);
      invalidate();
    },
  });
  const updateM = useMutation({
    mutationFn: (v: { id: string; content: string }) => updateFn({ data: v }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: invalidate,
  });

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-32">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">News</p>
        <h1 className="mt-1 text-3xl font-bold text-primary">Feed</h1>
      </header>

      <section className="mb-6 rounded-lg border bg-card p-4">
        {composing ? (
          <div className="space-y-3">
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Share an update with the squad…"
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setComposing(false);
                  setDraft("");
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!draft.trim() || createM.isPending}
                onClick={() => createM.mutate(draft.trim())}
              >
                Post
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setComposing(true)} className="w-full">
            New Post
          </Button>
        )}
      </section>

      <section className="space-y-3">
        {posts.length === 0 && (
          <p className="rounded-lg border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
            No posts yet.
          </p>
        )}
        {posts.map((p: any) => (
          <article key={p.id} className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserCircle2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-primary">{p.coach_name ?? "Coach"}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(p.created_at)}</p>
                </div>
              </div>
              {p.canEdit && editingId !== p.id && (
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(p.id);
                      setEditDraft(p.content);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Delete this post?",
                        description: "This cannot be undone.",
                        confirmLabel: "Delete",
                        destructive: true,
                      });
                      if (ok) deleteM.mutate(p.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {editingId === p.id ? (
              <div className="space-y-2">
                <Textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={4}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!editDraft.trim() || updateM.isPending}
                    onClick={() => updateM.mutate({ id: p.id, content: editDraft.trim() })}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-foreground">{p.content}</p>
            )}

            {p.is_player_note && p.player_id && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold text-accent">
                  Player note
                </span>
                <Link
                  to="/squad/$playerId"
                  params={{ playerId: p.player_id }}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {p.player_name ?? "View player"}
                </Link>
              </div>
            )}
          </article>
        ))}
      </section>
      {confirmDialog}
    </main>
  );
}
