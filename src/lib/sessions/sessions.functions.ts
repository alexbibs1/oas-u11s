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

async function resolveBlockId(context: any, sessionDate: string): Promise<string> {
  const { data: covering } = await context.supabase
    .from("blocks")
    .select("id")
    .lte("start_date", sessionDate)
    .gte("end_date", sessionDate)
    .limit(1)
    .maybeSingle();
  if (covering?.id) return covering.id;

  const { data: active } = await context.supabase
    .from("blocks")
    .select("id")
    .eq("is_active", true)
    .order("block_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (active?.id) return active.id;

  const { data: latest } = await context.supabase
    .from("blocks")
    .select("id")
    .order("block_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest?.id) return latest.id;

  throw new Error("No training block exists yet — create a block before adding sessions.");
}

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sessionInput)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const payload: any = {
      block_id: await resolveBlockId(context, data.session_date),
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
    const { error } = await context.supabase.from("sessions").delete().eq("id", data.id);
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
