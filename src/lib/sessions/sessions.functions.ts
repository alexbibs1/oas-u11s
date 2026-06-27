import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMatchSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sessions")
      .select(
        "id, session_date, session_type, week_number, block_id, opponent, venue, blocks:block_id ( id, name, block_number, is_active )",
      )
      .eq("session_type", "match")
      .order("session_date", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((s: any) => ({
      id: s.id,
      session_date: s.session_date,
      week_number: s.week_number,
      block_id: s.block_id,
      opponent: s.opponent,
      venue: s.venue,
      block_name: s.blocks?.name ?? `Block ${s.blocks?.block_number ?? ""}`,
      block_number: s.blocks?.block_number ?? null,
      block_is_active: !!s.blocks?.is_active,
    }));
  });

export const listAllSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sessions")
      .select(
        "id, session_date, session_type, week_number, block_id, opponent, venue, blocks:block_id ( id, name, block_number, is_active, start_date, end_date )",
      )
      .order("session_date", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((s: any) => ({
      id: s.id,
      session_date: s.session_date,
      session_type: s.session_type as "training" | "match",
      week_number: s.week_number as number | null,
      block_id: s.block_id as string,
      opponent: s.opponent as string | null,
      venue: s.venue as string | null,
      block_name: (s.blocks?.name ?? `Block ${s.blocks?.block_number ?? ""}`) as string,
      block_number: (s.blocks?.block_number ?? null) as number | null,
      block_is_active: !!s.blocks?.is_active,
      block_start_date: s.blocks?.start_date as string | null,
      block_end_date: s.blocks?.end_date as string | null,
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

const sessionInput = z.object({
  block_id: z.string().uuid(),
  session_date: z.string().min(8),
  session_type: z.enum(["training", "match"]),
  week_number: z.number().int().positive().nullable().optional(),
  opponent: z.string().max(200).nullable().optional(),
  venue: z.string().max(100).nullable().optional(),
});

async function assertBuilder(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "block_builder",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sessionInput)
  .handler(async ({ context, data }) => {
    await assertBuilder(context);
    const payload: any = {
      block_id: data.block_id,
      session_date: data.session_date,
      session_type: data.session_type,
      week_number: data.week_number ?? null,
      opponent: data.session_type === "match" ? data.opponent ?? null : null,
      venue: data.session_type === "match" ? data.venue ?? null : null,
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
    await assertBuilder(context);
    const { id, ...rest } = data;
    const payload: any = {
      block_id: rest.block_id,
      session_date: rest.session_date,
      session_type: rest.session_type,
      week_number: rest.week_number ?? null,
      opponent: rest.session_type === "match" ? rest.opponent ?? null : null,
      venue: rest.session_type === "match" ? rest.venue ?? null : null,
    };
    const { error } = await context.supabase.from("sessions").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertBuilder(context);
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
      .select(
        "id, session_date, session_type, week_number, block_id, opponent, venue, blocks:block_id ( id, name, block_number, is_active )",
      )
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return {
      ...s,
      block_name: (s as any).blocks?.name ?? `Block ${(s as any).blocks?.block_number ?? ""}`,
      block_number: (s as any).blocks?.block_number ?? null,
      block_is_active: !!(s as any).blocks?.is_active,
    } as any;
  });

export const getMatchSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select(
        "id, session_date, session_type, opponent, venue, block_id, blocks:block_id ( name, block_number )",
      )
      .eq("id", data.session_id)
      .single();
    if (sErr) throw new Error(sErr.message);
    const blockId = (session as any).block_id;

    const { data: groups } = await sb
      .from("groups")
      .select(
        "id, group_number, group_coaches:group_coaches ( coaches:coach_id ( coach_name ) ), group_players:group_players ( player_id )",
      )
      .eq("block_id", blockId)
      .order("group_number", { ascending: true });

    const { data: overrides } = await sb
      .from("session_player_overrides")
      .select("player_id, override_group_id")
      .eq("session_id", data.session_id);

    const { data: ratings } = await sb
      .from("match_ratings")
      .select("player_id, group_id, tackling, rucking, carrying, handling, kicking, catching, iq")
      .eq("session_id", data.session_id);

    const playerIds = new Set<string>();
    (groups ?? []).forEach((g: any) =>
      (g.group_players ?? []).forEach((gp: any) => playerIds.add(gp.player_id)),
    );
    (overrides ?? []).forEach((o: any) => playerIds.add(o.player_id));
    const { data: players } = playerIds.size
      ? await sb
          .from("players")
          .select("id, player_name")
          .in("id", Array.from(playerIds))
      : { data: [] as any[] };
    const pMap = new Map((players ?? []).map((p: any) => [p.id, p.player_name]));
    const oMap = new Map(
      (overrides ?? []).map((o: any) => [o.player_id, o.override_group_id as string | null]),
    );

    const groupSummaries = (groups ?? []).map((g: any) => {
      const defaultIds: string[] = (g.group_players ?? []).map((gp: any) => gp.player_id);
      const present: { id: string; name: string }[] = [];
      const absent: { id: string; name: string }[] = [];
      const movedIn: { id: string; name: string }[] = [];

      defaultIds.forEach((pid) => {
        const has = oMap.has(pid);
        const target = oMap.get(pid);
        if (!has) return; // no register entry
        if (target === g.id) present.push({ id: pid, name: pMap.get(pid) ?? "—" });
        else if (target === null) absent.push({ id: pid, name: pMap.get(pid) ?? "—" });
        // else moved out → don't show
      });

      (overrides ?? []).forEach((o: any) => {
        if (o.override_group_id === g.id && !defaultIds.includes(o.player_id)) {
          movedIn.push({ id: o.player_id, name: pMap.get(o.player_id) ?? "—" });
          present.push({ id: o.player_id, name: pMap.get(o.player_id) ?? "—" });
        }
      });

      const groupRatings = (ratings ?? []).filter((r: any) => r.group_id === g.id);
      const ratingMap = new Map(groupRatings.map((r: any) => [r.player_id, r]));

      return {
        id: g.id,
        group_number: g.group_number,
        coaches: (g.group_coaches ?? [])
          .map((gc: any) => gc.coaches?.coach_name)
          .filter(Boolean) as string[],
        present,
        absent,
        movedIn,
        hasOverrides: defaultIds.some((pid) => oMap.has(pid)) || movedIn.length > 0,
        ratings: present.map((p) => ({
          player_id: p.id,
          name: p.name,
          scores: ratingMap.get(p.id) ?? null,
        })),
        hasRatings: groupRatings.length > 0,
      };
    });

    return {
      session: {
        id: (session as any).id,
        session_date: (session as any).session_date,
        session_type: (session as any).session_type,
        opponent: (session as any).opponent,
        venue: (session as any).venue,
        block_name:
          (session as any).blocks?.name ?? `Block ${(session as any).blocks?.block_number ?? ""}`,
        block_number: (session as any).blocks?.block_number ?? null,
      },
      groups: groupSummaries,
    };
  });
