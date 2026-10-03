import { Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { listCoaches } from "@/lib/coaches/coaches.functions";
import { linkCoachToUser, resetCoachPassword } from "@/lib/admin/coach-accounts.functions";
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

export function CoachAccountsSection() {
  const { data: coaches = [] } = useQuery({
    queryKey: qk.coaches.all,
    queryFn: () => listCoaches(),
  });
  const [linkCoachId, setLinkCoachId] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  const link = useMutation({
    mutationFn: () => linkCoachToUser({ data: { coach_id: linkCoachId, email: linkEmail } }),
    onSuccess: () => {
      toast.success("Coach linked to account");
      setLinkCoachId("");
      setLinkEmail("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: () => resetCoachPassword({ data: { email: resetEmail, password: resetPassword } }),
    onSuccess: () => {
      toast.success("Password reset");
      setResetPassword("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-lg border bg-card p-5">
        <h3 className="text-sm font-semibold">Link coach to account</h3>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">
          Connect an existing login to a coach record (e.g. Kieron → his email).
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (linkCoachId && linkEmail) link.mutate();
          }}
        >
          <div className="space-y-2">
            <Label>Coach name</Label>
            <Select value={linkCoachId} onValueChange={setLinkCoachId}>
              <SelectTrigger>
                <SelectValue placeholder="Select coach…" />
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
          <div className="space-y-2">
            <Label htmlFor="link-email">Their email</Label>
            <Input
              id="link-email"
              type="email"
              required
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              placeholder="coach@example.com"
            />
          </div>
          <Button
            type="submit"
            disabled={link.isPending || !linkCoachId || !linkEmail}
            className="w-full"
          >
            {link.isPending ? "Linking…" : "Link account"}
          </Button>
        </form>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <h3 className="text-sm font-semibold">Reset a password</h3>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">
          Sets a new password for any coach account. Alex only.
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (resetEmail && resetPassword) reset.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              required
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="coach@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              type="text"
              required
              minLength={6}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <Button
            type="submit"
            disabled={reset.isPending || !resetEmail || !resetPassword}
            className="w-full"
          >
            {reset.isPending ? "Resetting…" : "Reset password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
