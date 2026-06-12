import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listCoaches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("coaches")
      .select("*")
      .order("coach_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ coach_name: z.string().min(1).max(120) }))
  .handler(async ({ context, data }) => {
    const { error, data: row } = await context.supabase
      .from("coaches")
      .insert({ coach_name: data.coach_name.trim() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removeCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("coaches").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
