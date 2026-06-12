import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role, coach_id, coaches:coach_id ( coach_name )")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    const roles = (data ?? []).map((r: any) => r.role as string);
    const coachRow = (data ?? []).find((r: any) => r.coaches);
    const coachName = coachRow?.coaches?.coach_name ?? null;

    const email: string | null = (claims as any).email ?? null;
    const metaUsername: string | null =
      (claims as any).user_metadata?.username ?? null;

    let username = metaUsername;
    if (!username && email) {
      // Lazy backfill so existing users get a username without re-invite
      username = email.split("@")[0];
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { username },
      });
    }

    return {
      userId,
      email,
      username,
      roles,
      isBlockBuilder: roles.includes("block_builder"),
      isCoach: roles.includes("coach"),
      coachName,
    };
  });
