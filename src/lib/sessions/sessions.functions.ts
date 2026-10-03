import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "block_builder",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const listMatchSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sessions")
      .select("id, session_date, session_type, opponent, venue")
      .eq("session_type", "match")
      .order("session_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAllSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sessions")
      .select("id, session_date, session_type, opponent, venue")
      .order("session_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      session_date: string;
      session_type: "training" | "match";
      opponent: string | null;
      venue: string | null;
    }>;
  });

const sessionInput = z.object({
  session_date: z.string().min(8),
  session_type: z.enum(["training", "match"]),
  opponent: z.string().max(200).nullable().optional(),
  venue: z.string().max(100).nullable().optional(),
});

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sessionInput)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const payload: any = {
      session_date: data.session_date,
      session_type: data.session_type,
      opponent: data.session_type === "match" ? (data.opponent ?? null) : null,
      venue: data.session_type === "match" ? (data.venue ?? null) : null,
    };
    const { data: row, error } = await context.supabase
      .from("sessions")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sessionInput.extend({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { id, ...rest } = data;
    const payload: any = {
      session_date: rest.session_date,
      session_type: rest.session_type,
      opponent: rest.session_type === "match" ? (rest.opponent ?? null) : null,
      venue: rest.session_type === "match" ? (rest.venue ?? null) : null,
    };
    const { error } = await context.supabase.from("sessions").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    // A match with a register or scores is part of the season's record and is kept.
    const [ratings, regs] = await Promise.all([
      sb
        .from("skill_ratings")
        .select("id", { count: "exact", head: true })
        .eq("session_id", data.id),
      sb
        .from("session_registrations")
        .select("id", { count: "exact", head: true })
        .eq("session_id", data.id),
    ]);
    if (ratings.error) throw new Error(ratings.error.message);
    if (regs.error) throw new Error(regs.error.message);
    if ((ratings.count ?? 0) + (regs.count ?? 0) > 0) {
      throw new Error(
        "This match already has registers or scores, so it can't be deleted. Change its date or details instead.",
      );
    }
    const { error } = await sb.from("sessions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: s, error } = await context.supabase
      .from("sessions")
      .select("id, session_date, session_type, opponent, venue")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return s;
  });
