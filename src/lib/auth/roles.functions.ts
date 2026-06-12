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

    return {
      userId,
      email: (claims as any).email ?? null,
      roles,
      isBlockBuilder: roles.includes("block_builder"),
      isCoach: roles.includes("coach"),
      coachName,
    };
  });
