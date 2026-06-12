import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMatchSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sessions")
      .select("id, session_date, session_type, week_number, block_id, blocks:block_id ( id, name, block_number, is_active )")
      .eq("session_type", "match")
      .order("session_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((s: any) => ({
      id: s.id,
      session_date: s.session_date,
      week_number: s.week_number,
      block_id: s.block_id,
      block_name: s.blocks?.name ?? `Block ${s.blocks?.block_number ?? ""}`,
      block_number: s.blocks?.block_number ?? null,
      block_is_active: !!s.blocks?.is_active,
    }));
  });

export const listBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("blocks")
      .select("*")
      .order("block_number", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      block_id: z.string().uuid(),
      session_date: z.string().min(8),
      session_type: z.enum(["training", "match"]),
      week_number: z.number().int().positive().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "block_builder",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: row, error } = await context.supabase
      .from("sessions")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
