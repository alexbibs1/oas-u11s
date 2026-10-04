import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { listCoaches } from "@/lib/coaches/coaches.functions";
import { inviteUser } from "@/lib/admin/invite.functions";
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

export function InviteSection() {
  const { data: coaches = [] } = useQuery({
    queryKey: qk.coaches.all,
    queryFn: () => listCoaches(),
  });
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
                <SelectItem value="block_builder">Admin</SelectItem>
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
        <Button
          type="submit"
          disabled={m.isPending || (role === "coach" && !coachId)}
          className="w-full"
        >
          {m.isPending ? "Sending…" : "Send invite"}
        </Button>
      </form>
    </div>
  );
}
