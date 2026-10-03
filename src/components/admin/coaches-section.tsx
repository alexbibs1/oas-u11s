import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listCoaches, addCoach, removeCoach } from "@/lib/coaches/coaches.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { qk } from "@/lib/query-keys";
import { useConfirm } from "@/components/confirm-dialog";

export function CoachesSection() {
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: coaches = [] } = useQuery({
    queryKey: qk.coaches.all,
    queryFn: () => listCoaches(),
  });
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
                const ok = await confirm({
                  title: `Remove ${c.coach_name}?`,
                  description: "This coach will be removed.",
                  confirmLabel: "Remove",
                  destructive: true,
                });
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
