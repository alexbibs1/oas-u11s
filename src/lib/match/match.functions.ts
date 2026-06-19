import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { SKILL_KEYS } from "@/lib/skills";

const SKILL_SELECT = SKILL_KEYS.join(", ");

export const listGroupsForBlock = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ block_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: groups, error } = await context.supabase
      .from("groups")
      .select("id, group_number, group_coaches:group_coaches ( coach_id, coaches:coach_id ( coach_name ) )")
      .eq("block_id", data.block_id)
      .order("group_number", { ascending: true });
    if (error) throw new Error(error.message);
    return (groups ?? []).map((g: any) => ({
      id: g.id,
      group_number: g.group_number,
      coaches: (g.group_coaches ?? [])
        .map((gc: any) => gc.coaches?.coach_name)
        .filter(Boolean) as string[],
    }));
  });

/**
 * Returns the effective player roster for (session, group):
 * - Players whose default group is this group, MINUS those whose override moves them elsewhere or marks absent
 * - PLUS players moved IN by override to this group
 * Also returns existing overrides, ratings, and locked status.
 */
export const getMatchDayContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string().uuid(), group_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;

    // Default roster from group_players
    const { data: defaultRoster, error: e1 } = await supabase
      .from("group_players")
      .select(`player_id, players:player_id ( id, player_name, ${SKILL_SELECT}, speed, strength, repeatability )`)
      .eq("group_id", data.group_id);
    if (e1) throw new Error(e1.message);

    // All overrides for this session
    const { data: overrides, error: e2 } = await supabase
      .from("session_player_overrides")
      .select("*")
      .eq("session_id", data.session_id);
    if (e2) throw new Error(e2.message);

    // Players moved IN by override
    const movedInIds = (overrides ?? [])
      .filter((o: any) => o.override_group_id === data.group_id)
      .map((o: any) => o.player_id);

    let movedInPlayers: any[] = [];
    if (movedInIds.length) {
      const { data: pl, error: e3 } = await supabase
        .from("players")
        .select("id, player_name, tackling, rucking, carrying, kicking, catching, iq, speed")
        .in("id", movedInIds);
      if (e3) throw new Error(e3.message);
      movedInPlayers = pl ?? [];
    }

    // Existing ratings for this session+group
    const { data: ratings, error: e4 } = await supabase
      .from("match_ratings")
      .select("*")
      .eq("session_id", data.session_id)
      .eq("group_id", data.group_id);
    if (e4) throw new Error(e4.message);

    // Locked = any override row exists for any player whose default group is this group_id
    const defaultIds = new Set((defaultRoster ?? []).map((r: any) => r.player_id));
    const lockedByOverride = (overrides ?? []).some(
      (o: any) => defaultIds.has(o.player_id) || o.override_group_id === data.group_id,
    );

    return {
      defaultRoster: (defaultRoster ?? []).map((r: any) => r.players),
      movedInPlayers,
      overrides: overrides ?? [],
      ratings: ratings ?? [],
      locked: lockedByOverride,
    };
  });

export const saveRegister = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      session_id: z.string().uuid(),
      group_id: z.string().uuid(),
      entries: z.array(
        z.object({
          player_id: z.string().uuid(),
          status: z.enum(["here", "absent", "move"]),
          move_to_group_id: z.string().uuid().nullable().optional(),
        }),
      ),
    }),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    // Build override rows for every entry from this group's default roster
    const rows = data.entries.map((e) => ({
      session_id: data.session_id,
      player_id: e.player_id,
      override_group_id:
        e.status === "here"
          ? data.group_id
          : e.status === "move"
            ? e.move_to_group_id ?? null
            : null,
      created_by: context.userId,
    }));

    // Remove any existing overrides for these players in this session, then insert fresh
    const playerIds = rows.map((r) => r.player_id);
    if (playerIds.length) {
      const { error: delErr } = await supabase
        .from("session_player_overrides")
        .delete()
        .eq("session_id", data.session_id)
        .in("player_id", playerIds);
      if (delErr) throw new Error(delErr.message);
    }
    if (rows.length) {
      const { error: insErr } = await supabase.from("session_player_overrides").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

export const unlockRegister = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string().uuid(), group_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "block_builder",
    });
    if (!isAdmin) throw new Error("Forbidden");

    // Get default roster ids
    const { data: roster } = await context.supabase
      .from("group_players")
      .select("player_id")
      .eq("group_id", data.group_id);
    const defaultIds = (roster ?? []).map((r: any) => r.player_id);

    // Delete overrides that target this group OR belong to a default player of this group
    const { error } = await context.supabase
      .from("session_player_overrides")
      .delete()
      .eq("session_id", data.session_id)
      .or(
        `override_group_id.eq.${data.group_id}${defaultIds.length ? `,player_id.in.(${defaultIds.join(",")})` : ""}`,
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitRatings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      session_id: z.string().uuid(),
      group_id: z.string().uuid(),
      block_id: z.string().uuid(),
      ratings: z.array(
        z.object({
          player_id: z.string().uuid(),
          tackling: z.number().int().min(1).max(5),
          rucking: z.number().int().min(1).max(5),
          carrying: z.number().int().min(1).max(5),
          kicking: z.number().int().min(1).max(5),
          catching: z.number().int().min(1).max(5),
          iq: z.number().int().min(1).max(5),
        }),
      ),
    }),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;

    const rows = data.ratings.map((r) => ({
      session_id: data.session_id,
      group_id: data.group_id,
      player_id: r.player_id,
      tackling: r.tackling,
      rucking: r.rucking,
      carrying: r.carrying,
      kicking: r.kicking,
      catching: r.catching,
      iq: r.iq,
      rated_by: context.userId,
    }));

    const { error } = await supabase
      .from("match_ratings")
      .upsert(rows, { onConflict: "session_id,player_id" });
    if (error) throw new Error(error.message);

    // Recalculate baseline for each player across active block's sessions
    const { data: blockSessions } = await supabase
      .from("sessions")
      .select("id")
      .eq("block_id", data.block_id);
    const sessionIds = (blockSessions ?? []).map((s: any) => s.id);

    const playerIds = data.ratings.map((r) => r.player_id);
    if (sessionIds.length && playerIds.length) {
      const { data: allRatings } = await supabase
        .from("match_ratings")
        .select("player_id, tackling, rucking, carrying, kicking, catching, iq")
        .in("session_id", sessionIds)
        .in("player_id", playerIds);

      const byPlayer = new Map<string, any[]>();
      for (const r of allRatings ?? []) {
        if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, []);
        byPlayer.get(r.player_id)!.push(r);
      }

      for (const pid of playerIds) {
        const list = byPlayer.get(pid) ?? [];
        if (!list.length) continue;
        const avgSkill = (key: string) => {
          const vals = list.map((x) => x[key]).filter((v) => v != null).map(Number);
          return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
        };
        const avg: Record<string, number> = {};
        for (const k of ["tackling", "rucking", "carrying", "kicking", "catching", "iq"]) {
          const v = avgSkill(k);
          if (v != null) avg[k] = v;
        }
        if (Object.keys(avg).length) await supabase.from("players").update(avg as any).eq("id", pid);
      }
    }

    return { ok: true, count: rows.length };
  });
