import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().email(),
      role: z.enum(["block_builder", "coach"]),
      coach_id: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    // Authorize: caller must be a block_builder
    const { data: isBuilder, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "block_builder",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isBuilder) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
    );
    if (inviteErr) throw new Error(inviteErr.message);
    const newUserId = invite.user?.id;
    if (!newUserId) throw new Error("Invite did not return a user id");

    const { error: insertErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: newUserId,
      role: data.role,
      coach_id: data.role === "coach" ? data.coach_id ?? null : null,
    });
    if (insertErr) throw new Error(insertErr.message);

    return { ok: true, userId: newUserId };
  });
