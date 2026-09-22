import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SKILL_FIELDS = "carrying, handling, tackling, rucking, kicking, catching, iq";

/** Player history of match ratings — most recent first. */
export const listPlayerSkillRatings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ player_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: rows, error } = await sb
      .from("skill_ratings")
      .select(
        `id, session_id, coach_names, entered_by_name, created_at, updated_at, ${SKILL_FIELDS},
         sessions:session_id ( session_date, opponent )`,
      )
      .eq("player_id", data.player_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      session_date: r.sessions?.session_date,
      opponent: r.sessions?.opponent,
    }));
  });
