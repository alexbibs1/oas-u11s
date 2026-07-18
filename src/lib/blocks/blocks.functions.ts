import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertBuilder(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "block_builder",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const listBlocksWithMeta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: blocks, error } = await sb
      .from("blocks")
      .select("id, block_number, name, start_date, end_date, is_active")
      .order("block_number", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: groups } = await sb.from("groups").select("id, block_id");
    const groupsByBlock = new Map<string, number>();
    (groups ?? []).forEach((g: any) => {
      groupsByBlock.set(g.block_id, (groupsByBlock.get(g.block_id) ?? 0) + 1);
    });
    return (blocks ?? []).map((b: any) => ({
      ...b,
      group_count: groupsByBlock.get(b.id) ?? 0,
    }));
  });

export const getBlockBuilderData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ block_id: z.string().uuid().nullable() }))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;

    const { data: players } = await sb
      .from("players")
      .select(
        "id, player_name, tackling, rucking, carrying, handling, kicking, catching, iq, speed, strength, repeatability",
      )
      .order("player_name", { ascending: true });

    // Attendance reliability across all sessions
    const { data: sessions } = await sb.from("sessions").select("id");
    const totalSessions = (sessions ?? []).length;
    const { data: att } = await sb.from("attendance").select("player_id, present");
    const presentMap = new Map<string, number>();
    (att ?? []).forEach((a: any) => {
      if (a.present) presentMap.set(a.player_id, (presentMap.get(a.player_id) ?? 0) + 1);
    });

    // Previous block — most recent block with groups, excluding the editing block
    const { data: allBlocks } = await sb
      .from("blocks")
      .select("id, block_number")
      .order("block_number", { ascending: false });
    const prevBlock = (allBlocks ?? []).find((b: any) => b.id !== data.block_id);
    const prevGroupByPlayer = new Map<string, number>();
    if (prevBlock) {
      const { data: prevGroups } = await sb
        .from("groups")
        .select("id, group_number, group_players:group_players ( player_id )")
        .eq("block_id", prevBlock.id);
      (prevGroups ?? []).forEach((g: any) => {
        (g.group_players ?? []).forEach((gp: any) => {
          prevGroupByPlayer.set(gp.player_id, g.group_number);
        });
      });
    }

    // Editing block — load existing groups, coaches, players if editing
    let block: any = null;
    let groups: Array<{
      id: string;
      group_number: number;
      coach_ids: string[];
      player_ids: string[];
    }> = [];
    if (data.block_id) {
      const { data: b } = await sb
        .from("blocks")
        .select("id, block_number, name, start_date, end_date, is_active")
        .eq("id", data.block_id)
        .single();
      block = b;
      const { data: gs } = await sb
        .from("groups")
        .select(
          "id, group_number, group_coaches:group_coaches ( coach_id ), group_players:group_players ( player_id )",
        )
        .eq("block_id", data.block_id)
        .order("group_number", { ascending: true });
      groups = (gs ?? []).map((g: any) => ({
        id: g.id,
        group_number: g.group_number,
        coach_ids: (g.group_coaches ?? []).map((gc: any) => gc.coach_id),
        player_ids: (g.group_players ?? []).map((gp: any) => gp.player_id),
      }));
    }

    const enrichedPlayers = (players ?? []).map((p: any) => ({
      ...p,
      attendance_pct:
        totalSessions === 0
          ? null
          : Math.round(((presentMap.get(p.id) ?? 0) / totalSessions) * 100),
      previous_group: prevGroupByPlayer.get(p.id) ?? null,
    }));

    const { data: coaches } = await sb
      .from("coaches")
      .select("id, coach_name")
      .order("coach_name", { ascending: true });

    return {
      players: enrichedPlayers,
      coaches: coaches ?? [],
      block,
      groups,
      total_sessions: totalSessions,
    };
  });

const groupInput = z.object({
  group_number: z.number().int().min(1).max(4),
  coach_ids: z.array(z.string().uuid()),
  player_ids: z.array(z.string().uuid()),
});

const saveBlockInput = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().min(1).max(120),
  start_date: z.string().min(8),
  end_date: z.string().min(8),
  is_active: z.boolean(),
  groups: z.array(groupInput).max(4),
});

export const saveBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(saveBlockInput)
  .handler(async ({ context, data }) => {
    await assertBuilder(context);
    const sb = context.supabase;

    let blockId = data.id;

    if (data.is_active) {
      // Deactivate any active blocks first
      await sb
        .from("blocks")
        .update({ is_active: false })
        .neq("id", blockId ?? "00000000-0000-0000-0000-000000000000");
    }

    if (!blockId) {
      const { data: maxRow } = await sb
        .from("blocks")
        .select("block_number")
        .order("block_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextNumber = ((maxRow as any)?.block_number ?? 0) + 1;
      const { data: inserted, error } = await sb
        .from("blocks")
        .insert({
          block_number: nextNumber,
          name: data.name,
          start_date: data.start_date,
          end_date: data.end_date,
          is_active: data.is_active,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      blockId = inserted.id;
    } else {
      const { error } = await sb
        .from("blocks")
        .update({
          name: data.name,
          start_date: data.start_date,
          end_date: data.end_date,
          is_active: data.is_active,
        })
        .eq("id", blockId);
      if (error) throw new Error(error.message);
    }

    // Upsert each group, clear children, reinsert assignments
    for (const g of data.groups) {
      const { data: existing } = await sb
        .from("groups")
        .select("id")
        .eq("block_id", blockId)
        .eq("group_number", g.group_number)
        .maybeSingle();
      let groupId = (existing as any)?.id;
      if (!groupId) {
        const { data: newG, error } = await sb
          .from("groups")
          .insert({ block_id: blockId, group_number: g.group_number })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        groupId = newG.id;
      }
      await sb.from("group_players").delete().eq("group_id", groupId);
      await sb.from("group_coaches").delete().eq("group_id", groupId);
      if (g.player_ids.length) {
        const { error: pe } = await sb
          .from("group_players")
          .insert(g.player_ids.map((pid) => ({ group_id: groupId, player_id: pid })));
        if (pe) throw new Error(pe.message);
      }
      if (g.coach_ids.length) {
        const { error: ce } = await sb
          .from("group_coaches")
          .insert(g.coach_ids.map((cid) => ({ group_id: groupId, coach_id: cid })));
        if (ce) throw new Error(ce.message);
      }
    }

    return { ok: true, id: blockId };
  });

export const setActiveBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertBuilder(context);
    const sb = context.supabase;
    await sb.from("blocks").update({ is_active: false }).neq("id", data.id);
    const { error } = await sb.from("blocks").update({ is_active: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
