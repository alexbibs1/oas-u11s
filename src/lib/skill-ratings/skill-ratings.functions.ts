import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SKILL_KEYS } from "@/lib/skills";

const SKILL_FIELDS = "carrying, handling, tackling, rucking, kicking, catching, iq";

/** All match-type sessions in the currently active block. */
export const listMatchWeeks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: block } = await sb
      .from("blocks")
      .select("id, name, block_number, start_date, end_date")
      .eq("is_active", true)
      .order("block_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!block) return { block: null, weeks: [] };
    const { data: sessions } = await sb
      .from("sessions")
      .select("id, session_date, week_number, opponent, venue")
      .eq("block_id", (block as any).id)
      .eq("session_type", "match")
      .order("session_date", { ascending: false });
    const weeks = (sessions ?? []).map((s: any) => {
      const wk =
        s.week_number ??
        ((block as any).start_date
          ? Math.max(
              1,
              Math.floor(
                (new Date(s.session_date).getTime() - new Date((block as any).start_date).getTime()) /
                  (7 * 86400000),
              ) + 1,
            )
          : null);
      return { ...s, week_number: wk };
    });
    return { block, weeks };
  });

/** Returns groups (in the active block) that the current user coaches, OR all groups if admin. */
export const getMyGroupsForWeek = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("id, block_id, session_date")
      .eq("id", data.session_id)
      .single();
    if (sErr) throw new Error(sErr.message);

    const { data: isAdmin } = await sb.rpc("has_role", {
      _user_id: context.userId,
      _role: "block_builder",
    });

    // Find this user's coach_id if any
    const { data: rolesData } = await sb
      .from("user_roles")
      .select("coach_id")
      .eq("user_id", context.userId);
    const myCoachIds = (rolesData ?? [])
      .map((r: any) => r.coach_id)
      .filter(Boolean) as string[];

    // All groups in this block with their coaches
    const { data: groups } = await sb
      .from("groups")
      .select(
        "id, group_number, group_coaches:group_coaches ( coach_id, coaches:coach_id ( id, coach_name ) )",
      )
      .eq("block_id", (session as any).block_id)
      .order("group_number", { ascending: true });

    const mapped = (groups ?? []).map((g: any) => ({
      id: g.id,
      group_number: g.group_number,
      coaches: (g.group_coaches ?? []).map((gc: any) => ({
        id: gc.coach_id,
        name: gc.coaches?.coach_name ?? "",
      })),
    }));

    const visible = isAdmin
      ? mapped
      : mapped.filter((g) => g.coaches.some((c: any) => myCoachIds.includes(c.id)));

    return {
      groups: visible,
      isAdmin: !!isAdmin,
      session,
    };
  });

/** Players in this group for the given session, excluding anyone marked absent via session_player_overrides. */
export const getGroupRosterForWeek = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string().uuid(), group_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: roster } = await sb
      .from("group_players")
      .select("player_id, players:player_id ( id, player_name )")
      .eq("group_id", data.group_id);
    const { data: overrides } = await sb
      .from("session_player_overrides")
      .select("player_id, override_group_id")
      .eq("session_id", data.session_id);
    const absentOrMoved = new Set(
      (overrides ?? [])
        .filter((o: any) => o.override_group_id === null || o.override_group_id !== data.group_id)
        .map((o: any) => o.player_id),
    );
    const movedIn = (overrides ?? [])
      .filter((o: any) => o.override_group_id === data.group_id)
      .map((o: any) => o.player_id);
    const players = (roster ?? [])
      .map((r: any) => r.players)
      .filter((p: any) => p && !absentOrMoved.has(p.id));

    let extra: any[] = [];
    if (movedIn.length) {
      const { data: ex } = await sb
        .from("players")
        .select("id, player_name")
        .in("id", movedIn);
      extra = ex ?? [];
    }

    // Existing skill_ratings for the players in this group/session

    const ids = [...players, ...extra].map((p: any) => p.id);
    const { data: existingByPlayer } = ids.length
      ? await sb
          .from("skill_ratings")
          .select(`id, player_id, ${SKILL_FIELDS}, coach_names, entered_by_name, updated_at`)
          .eq("session_id", data.session_id)
          .in("player_id", ids)
      : { data: [] as any[] };

    return {
      players: [...players, ...extra].sort((a, b) =>
        a.player_name.localeCompare(b.player_name),
      ),
      existing: existingByPlayer ?? [],
    };
  });

const ratingsInput = z.object({
  session_id: z.string().uuid(),
  group_id: z.string().uuid(),
  ratings: z.array(
    z.object({
      player_id: z.string().uuid(),
      carrying: z.number().int().min(1).max(5),
      handling: z.number().int().min(1).max(5),
      tackling: z.number().int().min(1).max(5),
      rucking: z.number().int().min(1).max(5),
      kicking: z.number().int().min(1).max(5),
      catching: z.number().int().min(1).max(5),
      iq: z.number().int().min(1).max(5),
    }),
  ),
});

export const upsertWeekRatings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ratingsInput)
  .handler(async ({ context, data }) => {
    const sb = context.supabase;

    // Session + block context
    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("id, block_id, session_date, week_number, blocks:block_id ( start_date )")
      .eq("id", data.session_id)
      .single();
    if (sErr) throw new Error(sErr.message);

    const blockId = (session as any).block_id;
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

    // Group snapshot
    const { data: group, error: gErr } = await sb
      .from("groups")
      .select(
        "id, group_number, group_coaches:group_coaches ( coaches:coach_id ( coach_name ) )",
      )
      .eq("id", data.group_id)
      .single();
    if (gErr) throw new Error(gErr.message);
    const coachNames = ((group as any).group_coaches ?? [])
      .map((gc: any) => gc.coaches?.coach_name)
      .filter(Boolean) as string[];
    const groupNumber = (group as any).group_number as number;

    // Caller info
    const { data: myRole } = await sb
      .from("user_roles")
      .select("coach_id, coaches:coach_id ( coach_name )")
      .eq("user_id", context.userId)
      .maybeSingle();
    const myName =
      ((myRole as any)?.coaches?.coach_name as string | undefined) ??
      ((context as any).claims?.email as string | undefined) ??
      null;

    // Player names + existing rows
    const pIds = data.ratings.map((r) => r.player_id);
    const { data: players } = await sb
      .from("players")
      .select("id, player_name")
      .in("id", pIds);
    const nameMap = new Map((players ?? []).map((p: any) => [p.id, p.player_name]));

    const { data: existing } = await sb
      .from("skill_ratings")
      .select(`id, player_id, ${SKILL_FIELDS}`)
      .eq("session_id", data.session_id)
      .in("player_id", pIds);
    const existingMap = new Map((existing ?? []).map((e: any) => [e.player_id, e]));

    const inserts: any[] = [];
    const updates: { row: any; old: any; changed: string[] }[] = [];

    for (const r of data.ratings) {
      const base: any = {
        session_id: data.session_id,
        player_id: r.player_id,
        player_name: nameMap.get(r.player_id) ?? "",
        block_id: blockId,
        group_number: groupNumber,
        week_number: weekNumber,
        coach_names: coachNames,
        entered_by: context.userId,
        entered_by_name: myName,
        carrying: r.carrying,
        handling: r.handling,
        tackling: r.tackling,
        rucking: r.rucking,
        kicking: r.kicking,
        catching: r.catching,
        iq: r.iq,
      };
      const prev = existingMap.get(r.player_id);
      if (!prev) {
        inserts.push(base);
      } else {
        const changed = SKILL_KEYS.filter((k) => (prev as any)[k] !== (r as any)[k]);
        if (changed.length) updates.push({ row: { id: (prev as any).id, ...base }, old: prev, changed });
      }
    }

    if (inserts.length) {
      const { error } = await sb.from("skill_ratings").insert(inserts);
      if (error) throw new Error(error.message);
    }
    for (const u of updates) {
      const { error } = await sb
        .from("skill_ratings")
        .update(u.row)
        .eq("id", u.row.id);
      if (error) throw new Error(error.message);
      const oldVals: any = {};
      const newVals: any = {};
      for (const k of u.changed) {
        oldVals[k] = (u.old as any)[k];
        newVals[k] = (u.row as any)[k];
      }
      await sb.from("audit_log").insert({
        changed_by: context.userId,
        table_name: "skill_ratings",
        record_id: u.row.id,
        operation: "update",
        old_values: oldVals,
        new_values: newVals,
        metadata: {
          player_name: u.row.player_name,
          week_number: weekNumber,
          group_number: groupNumber,
          changed_fields: u.changed,
        },
      });
    }

    return { ok: true, inserted: inserts.length, updated: updates.length };
  });

/** Player history of weekly ratings — most recent first. */
export const listPlayerSkillRatings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ player_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: rows, error } = await sb
      .from("skill_ratings")
      .select(
        `id, session_id, week_number, group_number, coach_names, entered_by_name, created_at, updated_at, ${SKILL_FIELDS},
         sessions:session_id ( session_date, opponent ),
         blocks:block_id ( name, block_number )`,
      )
      .eq("player_id", data.player_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      session_date: r.sessions?.session_date,
      opponent: r.sessions?.opponent,
      block_label: r.blocks?.name ?? (r.blocks?.block_number ? `Block ${r.blocks.block_number}` : null),
    }));
  });

/** Admin completion tracker for a given match week. */
export const getWeekCompletion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("id, block_id, session_date, week_number")
      .eq("id", data.session_id)
      .single();
    if (sErr) throw new Error(sErr.message);

    const { data: groups } = await sb
      .from("groups")
      .select(
        "id, group_number, group_coaches:group_coaches ( coaches:coach_id ( coach_name ) ), group_players:group_players ( player_id )",
      )
      .eq("block_id", (session as any).block_id)
      .order("group_number", { ascending: true });

    const { data: overrides } = await sb
      .from("session_player_overrides")
      .select("player_id, override_group_id")
      .eq("session_id", data.session_id);
    const absent = new Set(
      (overrides ?? []).filter((o: any) => o.override_group_id === null).map((o: any) => o.player_id),
    );
    const movedTo = new Map<string, string>();
    (overrides ?? []).forEach((o: any) => {
      if (o.override_group_id) movedTo.set(o.player_id, o.override_group_id);
    });

    const { data: ratings } = await sb
      .from("skill_ratings")
      .select("player_id, group_number")
      .eq("session_id", data.session_id);
    const ratedSet = new Set((ratings ?? []).map((r: any) => r.player_id));

    const result = (groups ?? []).map((g: any) => {
      const defaultIds = (g.group_players ?? []).map((gp: any) => gp.player_id);
      // expected = (default minus absent minus moved-out) + moved-in
      const inGroup = new Set<string>();
      for (const pid of defaultIds) {
        if (absent.has(pid)) continue;
        const moved = movedTo.get(pid);
        if (moved && moved !== g.id) continue;
        inGroup.add(pid);
      }
      for (const [pid, gid] of movedTo) {
        if (gid === g.id) inGroup.add(pid);
      }
      const expected = inGroup.size;
      let rated = 0;
      for (const pid of inGroup) if (ratedSet.has(pid)) rated += 1;
      let status: "not_started" | "partial" | "submitted";
      if (rated === 0) status = "not_started";
      else if (rated >= expected) status = "submitted";
      else status = "partial";
      return {
        group_id: g.id,
        group_number: g.group_number,
        coaches: (g.group_coaches ?? [])
          .map((gc: any) => gc.coaches?.coach_name)
          .filter(Boolean) as string[],
        rated,
        expected,
        status,
      };
    });

    return { session, groups: result };
  });
