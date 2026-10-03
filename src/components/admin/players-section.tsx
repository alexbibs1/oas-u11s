import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listPlayers,
  addPlayer,
  removePlayer,
  bulkAddPlayers,
  deactivatePlayer,
  renamePlayer,
} from "@/lib/players/players.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Pencil, UserX, RotateCcw, ListPlus, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { qk } from "@/lib/query-keys";
import { useConfirm } from "@/components/confirm-dialog";

export function PlayersSection() {
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const {
    data: players = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: qk.players.all, queryFn: () => listPlayers() });
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
      toast.error(
        /foreign key|violates/i.test(msg)
          ? "This player has match scores or coach notes, so they can't be removed. Deactivate them instead to keep their history."
          : msg || "Failed to remove player",
      );
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
    mutationFn: (v: { id: string; player_name: string }) => renamePlayer({ data: v }),
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
      search.trim() ? p.player_name.toLowerCase().includes(search.trim().toLowerCase()) : true,
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
      description:
        making === "deactivat"
          ? "Deactivating keeps all their ratings and history but hides them from squad lists and team assignment."
          : "Reactivating makes the player visible in squad lists and available for team assignment again.",
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
              {bulkNames.length} name{bulkNames.length === 1 ? "" : "s"} ready (duplicates are
              skipped)
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
                {bulkAdd.isPending
                  ? "Adding…"
                  : `Add ${bulkNames.length || ""} player${bulkNames.length === 1 ? "" : "s"}`}
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
          {search.trim()
            ? "No players match your search."
            : showInactive
              ? "No inactive players."
              : "No active players."}
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
                      aria-label={
                        isActive(p) ? `Deactivate ${p.player_name}` : `Reactivate ${p.player_name}`
                      }
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
