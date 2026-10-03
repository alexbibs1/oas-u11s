import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { listPlayers, updatePlayerAttribute } from "@/lib/players/players.functions";
import { ATTRIBUTES, SKILLS, REPEATABILITY_DESCRIPTORS } from "@/lib/skills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { qk } from "@/lib/query-keys";

export type AttrKey =
  | "speed"
  | "strength"
  | "repeatability"
  | "carrying"
  | "handling"
  | "tackling"
  | "rucking"
  | "kicking"
  | "iq";

export type PendingAttr = {
  playerId: string;
  playerName: string;
  attribute: AttrKey;
  attributeLabel: string;
  oldValue: number;
  newValue: number;
};

export function AttributesSection() {
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
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const pendingCountFor = (id: string) => pendingChanges.filter((c) => c.playerId === id).length;

  const renderRow = (p: any, def: { key: string; label: string }) => {
    const current = (p[def.key] as number | undefined) ?? 0;
    const pendingChange = pendingChanges.find(
      (c) => c.playerId === p.id && c.attribute === (def.key as AttrKey),
    );
    const displayValue = pendingChange?.newValue ?? current;
    const isChanged = !!pendingChange;
    const descriptor =
      def.key === "repeatability" ? REPEATABILITY_DESCRIPTORS[displayValue] : undefined;
    return (
      <div key={def.key}>
        <div className="flex items-center justify-between gap-2">
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
        {descriptor && (
          <p className="mt-0.5 text-right text-[11px] italic text-muted-foreground">{descriptor}</p>
        )}
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
    ? players.filter((p: any) => p.player_name.toLowerCase().includes(search.trim().toLowerCase()))
    : players;

  const allExpanded =
    filteredPlayers.length > 0 && filteredPlayers.every((p: any) => expandedIds.includes(p.id));

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Baselines</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Batch confirmation
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Tap a player to edit their baseline skills and attributes. Review and confirm all changes at
        once — every saved change is audited.
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
          onClick={() => setExpandedIds(allExpanded ? [] : filteredPlayers.map((p: any) => p.id))}
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
