import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SKILL_KEYS, ATTRIBUTE_KEYS } from "@/lib/skills";

async function fetchQuartileMap(sb: any): Promise<Map<string, number>> {
  const allKeys = [...SKILL_KEYS, ...ATTRIBUTE_KEYS] as string[];
  const { data: players } = await sb
    .from("players")
    .select(
      "id, tackling, rucking, carrying, handling, kicking, catching, iq, speed, strength, repeatability",
    );
  const scored = (players ?? []).map((p: any) => {
    const values = allKeys.map((k) => (p as any)[k] as number);
    return { id: p.id, overall: values.reduce((a: number, b: number) => a + b, 0) / values.length };
  });
  scored.sort((a: any, b: any) => b.overall - a.overall);
  const quartileSize = Math.max(1, Math.ceil(scored.length / 4));
  const map = new Map<string, number>();
  scored.forEach((p: any, i: number) => {
    map.set(p.id, Math.min(Math.floor(i / quartileSize) + 1, 4));
  });
  return map;
}



export const getGroupDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ group_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: group, error: gErr } = await sb
      .from("groups")
      .select(
        "id, group_number, block_id, blocks:block_id ( id, name, block_number, is_active, start_date, end_date ), group_coaches:group_coaches ( coaches:coach_id ( coach_name ) )",
      )
      .eq("id", data.group_id)
      .single();
    if (gErr) throw new Error(gErr.message);
    const { data: roster, error: rErr } = await sb
      .from("group_players")
      .select(
        "player_id, players:player_id ( id, player_name, tackling, rucking, carrying, handling, kicking, catching, iq, speed, strength, repeatability )",
      )
      .eq("group_id", data.group_id)
      .order("player_name", { referencedTable: "players", ascending: true });
    if (rErr) throw new Error(rErr.message);
    return {
      group: {
        id: (group as any).id,
        group_number: (group as any).group_number,
        block: (group as any).blocks,
      },
      coaches: ((group as any).group_coaches ?? [])
        .map((gc: any) => gc.coaches?.coach_name)
        .filter(Boolean) as string[],
      players: (roster ?? [])
        .map((r: any) => r.players)
        .filter(Boolean)
        .sort((a: any, b: any) => a.player_name.localeCompare(b.player_name)),
    };
  });

export const listGroupsForBlock = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ block_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: groups, error } = await context.supabase
      .from("groups")
      .select(
        "id, group_number, group_coaches:group_coaches ( coach_id, coaches:coach_id ( coach_name ) )",
      )
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
      .select(
        "player_id, players:player_id ( id, player_name, tackling, rucking, carrying, handling, kicking, catching, iq, speed, strength, repeatability )",
      )
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
        .select(
          "id, player_name, tackling, rucking, carrying, handling, kicking, catching, iq, speed, strength, repeatability",
        )
        .in("id", movedInIds);
      if (e3) throw new Error(e3.message);
      movedInPlayers = pl ?? [];
    }

    // Existing ratings for this session+group (source of truth is skill_ratings)
    const { data: ratings, error: e4 } = await supabase
      .from("skill_ratings")
      .select("player_id, group_id, carrying, handling, tackling, rucking, kicking, catching, iq")
      .eq("session_id", data.session_id)
      .eq("group_id", data.group_id);
    if (e4) throw new Error(e4.message);

    // Locked = any override row exists for any player whose default group is this group_id
    const defaultIds = new Set((defaultRoster ?? []).map((r: any) => r.player_id));
    const lockedByOverride = (overrides ?? []).some(
      (o: any) => defaultIds.has(o.player_id) || o.override_group_id === data.group_id,
    );

    // Players moved OUT of this group (override target is absent or a different group)
    const movedOutIds = new Set(
      (overrides ?? [])
        .filter((o: any) => defaultIds.has(o.player_id) && o.override_group_id !== data.group_id)
        .map((o: any) => o.player_id),
    );

    const filteredDefaultRoster = (defaultRoster ?? [])
      .map((r: any) => r.players)
      .filter((p: any) => p && !movedOutIds.has(p.id))
      .sort((a: any, b: any) => a.player_name.localeCompare(b.player_name));

    // Dedupe movedIn: exclude any players already appearing in defaultRoster
    const defaultRosterIds = new Set(filteredDefaultRoster.map((p: any) => p.id));
    const dedupedMovedIn = movedInPlayers
      .filter((p: any) => !defaultRosterIds.has(p.id))
      .sort((a: any, b: any) => a.player_name.localeCompare(b.player_name));

    return {
      defaultRoster: filteredDefaultRoster,
      movedInPlayers: dedupedMovedIn,
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
          status: z.enum(["present", "absent", "move"]),
          move_to_group_id: z.string().uuid().nullable().optional(),
        }),
      ),
    }),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;

    // Fetch current overrides for all submitted players so we can detect
    // moved-in players (their current override targets this group) and
    // preserve their override when they're marked "present".
    const playerIds = data.entries.map((e) => e.player_id);
    const { data: currentOverrides } = await supabase
      .from("session_player_overrides")
      .select("player_id, override_group_id")
      .eq("session_id", data.session_id)
      .in("player_id", playerIds);
    const currentByPid = new Map(
      (currentOverrides ?? []).map((o: any) => [o.player_id, o]),
    );

    const rows = data.entries
      .map((e) => {
        const current = currentByPid.get(e.player_id);
        const isMovedIn =
          current && (current as any).override_group_id === data.group_id;

        if (e.status === "present") {
          if (isMovedIn) {
            // Moved-in player marked present — keep their override so they
            // stay in this group.
            return {
              session_id: data.session_id,
              player_id: e.player_id,
              override_group_id: data.group_id,
              created_by: context.userId,
            };
          }
          // Default-roster player marked present — no override needed.
          return null;
        }

        return {
          session_id: data.session_id,
          player_id: e.player_id,
          override_group_id:
            e.status === "absent"
              ? null
              : e.status === "move"
                ? (e.move_to_group_id ?? null)
                : null,
          created_by: context.userId,
        };
      })
      .filter(Boolean) as any[];

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
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "block_builder",
    });
    if (!isAdmin) throw new Error("Forbidden: block_builder role required");
    // No-op: the "lock" is a UI concept. Coaches can re-save the register at
    // any time; saveRegister's delete-then-insert handles updates. We do NOT
    // delete override rows here — that would undo all player moves.
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
          handling: z.number().int().min(1).max(5),
          kicking: z.number().int().min(1).max(5),
          catching: z.number().int().min(1).max(5),
          iq: z.number().int().min(1).max(5),
        }),
      ),
    }),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;

    // Look up context needed for skill_ratings NOT NULL columns
    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .select("id, session_date, week_number, blocks:block_id ( start_date )")
      .eq("id", data.session_id)
      .single();
    if (sErr) throw new Error(sErr.message);

    let weekNumber = (session as any).week_number as number | null;
    if (!weekNumber && (session as any).blocks?.start_date) {
      weekNumber =
        Math.floor(
          (new Date((session as any).session_date).getTime() -
            new Date((session as any).blocks.start_date).getTime()) /
            (7 * 86400000),
        ) + 1;
      if (weekNumber < 1) weekNumber = 1;
    }

    const { data: group, error: gErr } = await supabase
      .from("groups")
      .select("id, group_number, group_coaches:group_coaches ( coaches:coach_id ( coach_name ) )")
      .eq("id", data.group_id)
      .single();
    if (gErr) throw new Error(gErr.message);
    const groupNumber = (group as any).group_number as number;
    const coachNames = ((group as any).group_coaches ?? [])
      .map((gc: any) => gc.coaches?.coach_name)
      .filter(Boolean) as string[];

    const playerIds = data.ratings.map((r) => r.player_id);
    const { data: players } = await supabase
      .from("players")
      .select("id, player_name")
      .in("id", playerIds);
    const nameMap = new Map((players ?? []).map((p: any) => [p.id, p.player_name]));

    // Dedupe by player_id — a single ON CONFLICT upsert can't affect the
    // same target row twice in one statement ("ON CONFLICT DO UPDATE
    // command cannot affect row a second time"). This can happen when a
    // player in the group's default roster is also explicitly marked
    // "Here" via an override, which surfaces them in both defaultRoster
    // AND movedInPlayers on the match-day UI. Keep the last rating per
    // player (in input order) so any later edits win.
    const seen = new Set<string>();
    const dedupedRatings = data.ratings.filter((r) => {
      if (seen.has(r.player_id)) return false;
      seen.add(r.player_id);
      return true;
    });

    const rows = dedupedRatings.map((r) => ({
      session_id: data.session_id,
      group_id: data.group_id,
      group_number: groupNumber,
      block_id: data.block_id,
      week_number: weekNumber,
      coach_names: coachNames,
      player_id: r.player_id,
      player_name: nameMap.get(r.player_id) ?? "",
      tackling: r.tackling,
      rucking: r.rucking,
      carrying: r.carrying,
      handling: r.handling,
      kicking: r.kicking,
      catching: r.catching,
      iq: r.iq,
      entered_by: context.userId,
    }));

    const { error } = await supabase
      .from("skill_ratings")
      .upsert(rows, { onConflict: "session_id,player_id" });
    if (error) throw new Error(error.message);

    return { ok: true, count: rows.length };
  });

