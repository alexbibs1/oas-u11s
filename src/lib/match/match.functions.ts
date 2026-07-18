import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    // Existing ratings for this session+group (now in skill_ratings, not match_ratings)
    const { data: ratings, error: e4 } = await supabase
      .from("skill_ratings")
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
    // Build override rows for every entry from this group's default roster.
    // "here" → override_group_id = this group (explicitly marks present so
    // the register is "submitted"); "absent" → null; "move" → other group.
    const rows = data.entries.map((e) => ({
      session_id: data.session_id,
      player_id: e.player_id,
      override_group_id:
        e.status === "here"
          ? data.group_id
          : e.status === "move"
            ? (e.move_to_group_id ?? null)
            : null,
      created_by: context.userId,
    }));

    // NOTE: delete-then-insert is not atomic across the two requests. Two
    // coaches submitting simultaneously for overlapping players can race.
    // The correct fix is a single PostgREST rpc() that does both in a
    // transaction. For now, we at least guard the empty array path so we
    // never issue a `.in("player_id", [])` which PostgREST rejects.
    const playerIds = rows.map((r) => r.player_id);
    if (playerIds.length === 0) {
      return { ok: true };
    }
    const { error: delErr } = await supabase
      .from("session_player_overrides")
      .delete()
      .eq("session_id", data.session_id)
      .in("player_id", playerIds);
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabase.from("session_player_overrides").insert(rows);
    if (insErr) throw new Error(insErr.message);
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
    if (!isAdmin) throw new Error("Forbidden: block_builder role required");

    // Get default roster ids for this group.
    const { data: roster, error: rErr } = await context.supabase
      .from("group_players")
      .select("player_id")
      .eq("group_id", data.group_id);
    if (rErr) throw new Error(rErr.message);
    const defaultIds = (roster ?? []).map((r: any) => r.player_id as string);

    // Delete overrides that target this group OR belong to a default player
    // of this group. Previously this was built as a single .or() string with
    // interpolation, which (a) broke when defaultIds was empty (trailing
    // comma) and (b) interpolated group_id directly into a filter string.
    // We now fetch the matching rows explicitly and delete by id — slightly
    // more queries but unambiguous and safe.
    let toDelete: string[] = [];
    {
      // overrides targeting this group (moved-in players)
      const { data: movedIn, error: mErr } = await context.supabase
        .from("session_player_overrides")
        .select("id, player_id")
        .eq("session_id", data.session_id)
        .eq("override_group_id", data.group_id);
      if (mErr) throw new Error(mErr.message);
      toDelete.push(...(movedIn ?? []).map((r: any) => r.id as string));
    }
    if (defaultIds.length) {
      const { data: defaulters, error: dErr } = await context.supabase
        .from("session_player_overrides")
        .select("id")
        .eq("session_id", data.session_id)
        .in("player_id", defaultIds);
      if (dErr) throw new Error(dErr.message);
      toDelete.push(...(defaulters ?? []).map((r: any) => r.id as string));
    }

    // Dedupe
    toDelete = Array.from(new Set(toDelete));
    if (toDelete.length === 0) return { ok: true, deleted: 0 };

    const { error } = await context.supabase
      .from("session_player_overrides")
      .delete()
      .in("id", toDelete);
    if (error) throw new Error(error.message);
    return { ok: true, deleted: toDelete.length };
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
    // Match-day ratings and weekly ratings used to write to two different
    // tables (match_ratings vs skill_ratings). They are now unified:
    // match-day submission delegates to upsertWeekRatings, which writes
    // skill_ratings AND the audit log. Baseline recomputation is handled
    // there too. This keeps the audit trail complete for ALL rating edits
    // and removes the parallel-source-of-truth bug.
    const { upsertWeekRatings } = await import("@/lib/skill-ratings/skill-ratings.functions");
    // upsertWeekRatings derives block_id from session_id itself, so we
    // strip the block_id that match-day.tsx sends (kept in submitRatings'
    // input validator for backwards compat with the existing UI call site).
    const { block_id: _blockId, ...rest } = data;
    return upsertWeekRatings({ data: rest });
  });
