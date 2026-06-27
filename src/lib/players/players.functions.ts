import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPlayers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("players")
      .select("*")
      .order("player_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getPlayer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("players")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const addPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ player_name: z.string().min(1).max(120) }))
  .handler(async ({ context, data }) => {
    const { error, data: row } = await context.supabase
      .from("players")
      .insert({ player_name: data.player_name.trim() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removePlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("players").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePlayerAttribute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      attribute: z.enum([
        "speed",
        "strength",
        "repeatability",
        "carrying",
        "handling",
        "tackling",
        "rucking",
        "kicking",
        "catching",
        "iq",
      ]),
      value: z.number().int().min(1).max(5),
    }),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "block_builder",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: existing, error: e0 } = await context.supabase
      .from("players")
      .select(`id, player_name, ${data.attribute}`)
      .eq("id", data.id)
      .single();
    if (e0) throw new Error(e0.message);
    const oldValue = (existing as any)[data.attribute] ?? null;
    const { error } = await context.supabase
      .from("players")
      .update({ [data.attribute]: data.value } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_log").insert({
      changed_by: context.userId,
      table_name: "players",
      record_id: data.id,
      operation: "update",
      old_values: { [data.attribute]: oldValue },
      new_values: { [data.attribute]: data.value },
      metadata: { player_name: (existing as any).player_name, attribute: data.attribute },
    });
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { limit?: number }) => input ?? {})
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "block_builder",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const limit = Math.min(Math.max(data?.limit ?? 100, 1), 500);
    const { data: rows, error } = await context.supabase
      .from("audit_log")
      .select("id, changed_by, table_name, record_id, operation, old_values, new_values, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getPlayerCurrentBlock = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ player_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: block } = await sb
      .from("blocks")
      .select("id, name, block_number")
      .eq("is_active", true)
      .order("block_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!block) return { block: null, group: null, coaches: [] as string[] };
    const { data: gpRows } = await sb
      .from("group_players")
      .select("groups:group_id ( id, group_number, block_id )")
      .eq("player_id", data.player_id);
    const g = (gpRows ?? [])
      .map((r: any) => r.groups)
      .find((x: any) => x?.block_id === (block as any).id);
    if (!g) return { block, group: null, coaches: [] as string[] };
    const { data: coachRows } = await sb
      .from("group_coaches")
      .select("coaches:coach_id ( coach_name )")
      .eq("group_id", g.id);
    const coaches = (coachRows ?? [])
      .map((r: any) => r.coaches?.coach_name)
      .filter(Boolean) as string[];
    return { block, group: { id: g.id, group_number: g.group_number }, coaches };
  });
