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
      attribute: z.enum(["speed", "strength", "repeatability"]),
      value: z.number().int().min(1).max(5),
    }),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "block_builder",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("players")
      .update({ [data.attribute]: data.value } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
