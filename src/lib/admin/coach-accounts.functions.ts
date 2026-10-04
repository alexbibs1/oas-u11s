import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// The single account allowed to reset other people's passwords.
const ALEX_EMAIL = "alexbibani@gmail.com";

async function assertBlockBuilder(context: any) {
  const { data: isBuilder, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "block_builder",
  });
  if (error) throw new Error(error.message);
  if (!isBuilder) throw new Error("Forbidden");
}

async function findUserByEmail(supabaseAdmin: any, email: string) {
  // Supabase admin client has no getUserByEmail; list and match by email.
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  const target = email.trim().toLowerCase();
  return (data.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === target) ?? null;
}

// Link an existing account (by email) to a coach record.
// Fixes accounts that were invited without a coach name (e.g. Kieron).
export const linkCoachToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      coach_id: z.string().uuid(),
      email: z.string().email(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertBlockBuilder(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await findUserByEmail(supabaseAdmin, data.email);
    if (!user) throw new Error("No account with that email — send them an invite first.");
    const { error } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: user.id, role: "coach", coach_id: data.coach_id },
      { onConflict: "user_id,role" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, userId: user.id };
  });

// Reset a coach's password. Restricted to Alex only.
export const resetCoachPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().email(),
      password: z.string().min(6).max(72),
    }),
  )
  .handler(async ({ context, data }) => {
    const me = ((context.claims as any)?.email ?? "").toLowerCase();
    if (me !== ALEX_EMAIL.toLowerCase()) {
      throw new Error("Forbidden: only Alex can reset passwords");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await findUserByEmail(supabaseAdmin, data.email);
    if (!user) throw new Error("No account with that email.");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
