import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createSession } from "@/lib/sessions/sessions.functions";
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
import { toast } from "sonner";
import { qk } from "@/lib/query-keys";

export function SessionsSection() {
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [type, setType] = useState<"training" | "match">("match");

  const m = useMutation({
    mutationFn: () =>
      createSession({
        data: { session_date: date, session_type: type },
      }),
    onSuccess: () => {
      toast.success("Session created");
      setDate("");
      qc.invalidateQueries({ queryKey: qk.sessions.matchList });
      qc.invalidateQueries({ queryKey: qk.sessions.list });
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
          if (date) m.mutate();
        }}
      >
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
        <Button type="submit" disabled={m.isPending || !date} className="w-full">
          {m.isPending ? "Creating…" : "Create session"}
        </Button>
      </form>
    </div>
  );
}
