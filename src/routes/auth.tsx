import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { bootstrapFirstAdmin, bootstrapStatus } from "@/lib/admin/bootstrap.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — OA Rugby" },
      { name: "description", content: "Sign in to OA Rugby" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  const checkStatus = useServerFn(bootstrapStatus);
  const createFirstAdmin = useServerFn(bootstrapFirstAdmin);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
    checkStatus().then((r) => setNeedsBootstrap(r.needsBootstrap)).catch(() => {});
  }, [navigate, checkStatus]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (needsBootstrap) {
        await createFirstAdmin({ data: { email, password } });
        toast.success("Admin account created");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/home", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-primary" />
            <span className="inline-block h-3 w-3 rounded-sm bg-accent" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">OA Rugby</h1>
          <p className="mt-1 text-sm text-muted-foreground">Player development</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          {needsBootstrap && (
            <div className="rounded-md border border-accent/40 bg-accent/10 p-3 text-xs text-foreground">
              No accounts yet. Create the first admin (block builder) below.
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={needsBootstrap ? "new-password" : "current-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading
              ? needsBootstrap
                ? "Creating…"
                : "Signing in…"
              : needsBootstrap
                ? "Create admin & sign in"
                : "Sign in"}
          </Button>
          {!needsBootstrap && (
            <p className="text-center text-xs text-muted-foreground">
              Accounts are created by invitation only.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
