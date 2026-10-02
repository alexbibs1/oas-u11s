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

// ============================================================
// Team picker (admin): pick up to 5 teams for a specific fixture.
// ============================================================
export const getMatchTeamBuilderData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;

    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("id, session_date, session_type, opponent, venue")
      .eq("id", data.session_id)
      .single();
    if (sErr) throw new Error(sErr.message);

    const { data: players } = await sb
      .from("players")
      .select(
        "id, player_name, tackling, rucking, carrying, handling, kicking, iq, speed, strength, repeatability, player_grouping",
      )
      .eq("is_active", true)
      .order("player_name", { ascending: true });

    const { data: coaches } = await sb
      .from("coaches")
      .select("id, coach_name")
      .order("coach_name", { ascending: true });

    const { data: teams } = await sb
      .from("match_teams")
      .select(
        "id, team_number, match_team_coaches:match_team_coaches ( coach_id ), match_team_players:match_team_players ( player_id )",
      )
      .eq("session_id", data.session_id)
      .order("team_number", { ascending: true });

    return {
      session,
      players: players ?? [],
      coaches: coaches ?? [],
      teams: (teams ?? []).map((t: any) => ({
        id: t.id,
        team_number: t.team_number,
        coach_ids: (t.match_team_coaches ?? []).map((c: any) => c.coach_id),
        player_ids: (t.match_team_players ?? []).map((p: any) => p.player_id),
      })),
    };
  });

const teamInput = z.object({
  team_number: z.number().int().min(1).max(5),
  coach_ids: z.array(z.string().uuid()),
  player_ids: z.array(z.string().uuid()),
});

export const saveMatchTeams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string().uuid(), teams: z.array(teamInput).max(5) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const sb = context.supabase;

    for (const t of data.teams) {
      const { data: existing } = await sb
        .from("match_teams")
        .select("id")
        .eq("session_id", data.session_id)
        .eq("team_number", t.team_number)
        .maybeSingle();
      let teamId = (existing as any)?.id;
      if (!teamId) {
        const { data: newT, error } = await sb
          .from("match_teams")
          .insert({ session_id: data.session_id, team_number: t.team_number })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        teamId = newT.id;
      }
      await sb.from("match_team_players").delete().eq("match_team_id", teamId);
      await sb.from("match_team_coaches").delete().eq("match_team_id", teamId);
      if (t.player_ids.length) {
        const { error } = await sb
          .from("match_team_players")
          .insert(t.player_ids.map((pid) => ({ match_team_id: teamId, player_id: pid })));
        if (error) throw new Error(error.message);
      }
      if (t.coach_ids.length) {
        const { error } = await sb
          .from("match_team_coaches")
          .insert(t.coach_ids.map((cid) => ({ match_team_id: teamId, coach_id: cid })));
        if (error) throw new Error(error.message);
      }
    }

    const keepNumbers = data.teams.map((t) => t.team_number);
    const { data: existingTeams } = await sb
      .from("match_teams")
      .select("id, team_number")
      .eq("session_id", data.session_id);
    const toDelete = (existingTeams ?? []).filter((t: any) => !keepNumbers.includes(t.team_number));
    for (const t of toDelete) {
      await sb.from("match_team_players").delete().eq("match_team_id", t.id);
      await sb.from("match_team_coaches").delete().eq("match_team_id", t.id);
      await sb.from("match_teams").delete().eq("id", t.id);
    }

    return { ok: true };
  });

// ============================================================
// Match day: session -> team -> register -> rate.
// ============================================================
export const getMatchTeamsForSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: teams, error } = await context.supabase
      .from("match_teams")
      .select(
        "id, team_number, match_team_coaches:match_team_coaches ( coach_id, coaches:coach_id ( coach_name ) )",
      )
      .eq("session_id", data.session_id)
      .order("team_number", { ascending: true });
    if (error) throw new Error(error.message);
    return (teams ?? []).map((t: any) => ({
      id: t.id,
      team_number: t.team_number,
      coaches: (t.match_team_coaches ?? [])
        .map((c: any) => c.coaches?.coach_name)
        .filter(Boolean) as string[],
    }));
  });

/**
 * Returns the effective player roster for (session, team):
 * - Players picked onto this team, MINUS those whose override moves them elsewhere
 * - Absent players stay visible so they can be toggled back to present
 * - PLUS players moved IN by override to this team
 */
export const getMatchDayContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string().uuid(), team_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;

    const { data: defaultRoster, error: e1 } = await supabase
      .from("match_team_players")
      .select(
        "player_id, players:player_id ( id, player_name, is_active, tackling, rucking, carrying, handling, kicking, iq, speed, strength, repeatability )",
      )
      .eq("match_team_id", data.team_id);
    if (e1) throw new Error(e1.message);

    const { data: overrides, error: e2 } = await supabase
      .from("session_player_overrides")
      .select("*")
      .eq("session_id", data.session_id);
    if (e2) throw new Error(e2.message);

    const movedInIds = (overrides ?? [])
      .filter((o: any) => o.override_team_id === data.team_id)
      .map((o: any) => o.player_id);

    let movedInPlayers: any[] = [];
    if (movedInIds.length) {
      const { data: pl, error: e3 } = await supabase
        .from("players")
        .select(
          "id, player_name, tackling, rucking, carrying, handling, kicking, iq, speed, strength, repeatability",
        )
        .in("id", movedInIds)
        .eq("is_active", true);
      if (e3) throw new Error(e3.message);
      movedInPlayers = pl ?? [];
    }

    const { data: ratings, error: e4 } = await supabase
      .from("skill_ratings")
      .select(
        "player_id, match_team_id, carrying, handling, tackling, rucking, kicking, iq, player_of_the_day",
      )
      .eq("session_id", data.session_id)
      .eq("match_team_id", data.team_id);
    if (e4) throw new Error(e4.message);

    const defaultIds = new Set((defaultRoster ?? []).map((r: any) => r.player_id));

    const movedOutIds = new Set(
      (overrides ?? [])
        .filter((o: any) => {
          const isDefaultPlayer = defaultIds.has(o.player_id);
          const target = o.override_team_id;
          return isDefaultPlayer && target !== null && target !== data.team_id;
        })
        .map((o: any) => o.player_id),
    );

    const filteredDefaultRoster = (defaultRoster ?? [])
      .map((r: any) => r.players)
      .filter((p: any) => p && p.is_active !== false && !movedOutIds.has(p.id))
      .sort((a: any, b: any) => a.player_name.localeCompare(b.player_name));

    const defaultRosterIds = new Set(filteredDefaultRoster.map((p: any) => p.id));
    const dedupedMovedIn = movedInPlayers
      .filter((p: any) => !defaultRosterIds.has(p.id))
      .sort((a: any, b: any) => a.player_name.localeCompare(b.player_name));

    return {
      defaultRoster: filteredDefaultRoster,
      movedInPlayers: dedupedMovedIn,
      overrides: overrides ?? [],
      ratings: ratings ?? [],
    };
  });

export const saveRegister = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      session_id: z.string().uuid(),
      team_id: z.string().uuid(),
      entries: z.array(
        z.object({
          player_id: z.string().uuid(),
          status: z.enum(["present", "absent", "move"]),
          move_to_team_id: z.string().uuid().nullable().optional(),
        }),
      ),
    }),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;

    const { data: team, error: gErr } = await supabase
      .from("match_teams")
      .select("id, match_team_coaches:match_team_coaches ( coach_id )")
      .eq("id", data.team_id)
      .single();
    if (gErr) throw new Error(gErr.message);
    const coachIds = ((team as any).match_team_coaches ?? [])
      .map((c: any) => c.coach_id)
      .filter(Boolean) as string[];
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "block_builder",
    });
    const { data: myRole } = await supabase
      .from("user_roles")
      .select("coach_id")
      .eq("user_id", context.userId)
      .not("coach_id", "is", null)
      .limit(1)
      .maybeSingle();
    const myCoachId = (myRole as any)?.coach_id as string | null | undefined;
    const isAssignedCoach = !!myCoachId && coachIds.includes(myCoachId);
    if (!isAdmin && !isAssignedCoach) {
      throw new Error("Forbidden: you are not a coach for this team");
    }

    const playerIds = data.entries.map((e) => e.player_id);
    const { data: currentOverrides } = await supabase
      .from("session_player_overrides")
      .select("player_id, override_team_id")
      .eq("session_id", data.session_id)
      .in("player_id", playerIds);
    const currentByPid = new Map((currentOverrides ?? []).map((o: any) => [o.player_id, o]));

    const rows = data.entries
      .map((e) => {
        const current = currentByPid.get(e.player_id);
        const isMovedIn = current && (current as any).override_team_id === data.team_id;

        if (e.status === "present") {
          if (isMovedIn) {
            return {
              session_id: data.session_id,
              player_id: e.player_id,
              override_team_id: data.team_id,
              created_by: context.userId,
            };
          }
          return null;
        }

        return {
          session_id: data.session_id,
          player_id: e.player_id,
          override_team_id:
            e.status === "absent" ? null : e.status === "move" ? (e.move_to_team_id ?? null) : null,
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

    const { error: regErr } = await supabase.from("session_registrations").upsert(
      {
        session_id: data.session_id,
        match_team_id: data.team_id,
        submitted_by: context.userId,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "session_id,match_team_id" },
    );
    if (regErr) throw new Error(regErr.message);

    return { ok: true };
  });

export const submitRatings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      session_id: z.string().uuid(),
      team_id: z.string().uuid(),
      ratings: z.array(
        z.object({
          player_id: z.string().uuid(),
          tackling: z.number().int().min(1).max(5),
          rucking: z.number().int().min(1).max(5),
          carrying: z.number().int().min(1).max(5),
          handling: z.number().int().min(1).max(5),
          kicking: z.number().int().min(1).max(5),
          iq: z.number().int().min(1).max(5),
        }),
      ),
      player_of_the_day_id: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;

    const { data: team, error: gErr } = await supabase
      .from("match_teams")
      .select(
        "id, team_number, match_team_coaches:match_team_coaches ( coach_id, coaches:coach_id ( coach_name ) )",
      )
      .eq("id", data.team_id)
      .single();
    if (gErr) throw new Error(gErr.message);
    const coachIds = ((team as any).match_team_coaches ?? [])
      .map((c: any) => c.coach_id)
      .filter(Boolean) as string[];
    const coachNames = ((team as any).match_team_coaches ?? [])
      .map((c: any) => c.coaches?.coach_name)
      .filter(Boolean) as string[];

    const { data: reg } = await supabase
      .from("session_registrations")
      .select("session_id")
      .eq("session_id", data.session_id)
      .eq("match_team_id", data.team_id)
      .maybeSingle();
    if (!reg) {
      throw new Error("Register must be submitted before ratings can be entered");
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "block_builder",
    });
    const { data: myRole } = await supabase
      .from("user_roles")
      .select("coach_id, coaches:coach_id ( coach_name )")
      .eq("user_id", context.userId)
      .not("coach_id", "is", null)
      .limit(1)
      .maybeSingle();
    const myCoachId = (myRole as any)?.coach_id as string | null | undefined;
    const isAssignedCoach = !!myCoachId && coachIds.includes(myCoachId);
    if (!isAdmin && !isAssignedCoach) {
      throw new Error("Forbidden: you are not a coach for this team");
    }
    const enteredByName =
      ((myRole as any)?.coaches?.coach_name as string | undefined) ??
      ((context as any).claims?.email as string | undefined) ??
      null;

    const playerIds = data.ratings.map((r) => r.player_id);
    const { data: players } = await supabase
      .from("players")
      .select("id, player_name")
      .in("id", playerIds);
    const nameMap = new Map((players ?? []).map((p: any) => [p.id, p.player_name]));

    const seen = new Set<string>();
    const dedupedRatings = data.ratings.filter((r) => {
      if (seen.has(r.player_id)) return false;
      seen.add(r.player_id);
      return true;
    });

    const rows = dedupedRatings.map((r) => ({
      session_id: data.session_id,
      match_team_id: data.team_id,
      coach_names: coachNames,
      player_id: r.player_id,
      player_name: nameMap.get(r.player_id) ?? "",
      tackling: r.tackling,
      rucking: r.rucking,
      carrying: r.carrying,
      handling: r.handling,
      kicking: r.kicking,
      iq: r.iq,
      entered_by: context.userId,
      entered_by_name: enteredByName,
    }));

    const { error } = await supabase
      .from("skill_ratings")
      .upsert(rows, { onConflict: "session_id,player_id" });
    if (error) throw new Error(error.message);

    await supabase
      .from("skill_ratings")
      .update({ player_of_the_day: false })
      .eq("session_id", data.session_id)
      .eq("match_team_id", data.team_id)
      .eq("player_of_the_day", true);
    if (data.player_of_the_day_id) {
      await supabase
        .from("skill_ratings")
        .update({ player_of_the_day: true })
        .eq("session_id", data.session_id)
        .eq("match_team_id", data.team_id)
        .eq("player_id", data.player_of_the_day_id);
    }

    return { ok: true, count: rows.length };
  });

// ============================================================
// Match summary + admin completion tracker.
// ============================================================
export const getMatchSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("id, session_date, session_type, opponent, venue")
      .eq("id", data.session_id)
      .single();
    if (sErr) throw new Error(sErr.message);

    const { data: teams } = await sb
      .from("match_teams")
      .select(
        "id, team_number, match_team_coaches:match_team_coaches ( coaches:coach_id ( coach_name ) ), match_team_players:match_team_players ( player_id )",
      )
      .eq("session_id", data.session_id)
      .order("team_number", { ascending: true });

    const { data: overrides } = await sb
      .from("session_player_overrides")
      .select("player_id, override_team_id")
      .eq("session_id", data.session_id);

    const { data: ratings } = await sb
      .from("skill_ratings")
      .select(
        "player_id, match_team_id, tackling, rucking, carrying, handling, kicking, iq, player_of_the_day",
      )
      .eq("session_id", data.session_id);

    const playerIds = new Set<string>();
    (teams ?? []).forEach((t: any) =>
      (t.match_team_players ?? []).forEach((tp: any) => playerIds.add(tp.player_id)),
    );
    (overrides ?? []).forEach((o: any) => playerIds.add(o.player_id));
    const { data: players } = playerIds.size
      ? await sb.from("players").select("id, player_name").in("id", Array.from(playerIds))
      : { data: [] as any[] };
    const pMap = new Map<string, string>(
      (players ?? []).map((p: any) => [p.id, p.player_name] as [string, string]),
    );
    const oMap = new Map(
      (overrides ?? []).map((o: any) => [o.player_id, o.override_team_id as string | null]),
    );

    const teamSummaries = (teams ?? []).map((t: any) => {
      const defaultIds: string[] = (t.match_team_players ?? []).map((tp: any) => tp.player_id);
      const present: { id: string; name: string }[] = [];
      const absent: { id: string; name: string }[] = [];
      const movedIn: { id: string; name: string }[] = [];

      defaultIds.forEach((pid) => {
        const has = oMap.has(pid);
        const target = oMap.get(pid);
        if (!has) {
          present.push({ id: pid, name: pMap.get(pid) ?? "—" });
          return;
        }
        if (target === t.id) present.push({ id: pid, name: pMap.get(pid) ?? "—" });
        else if (target === null) absent.push({ id: pid, name: pMap.get(pid) ?? "—" });
      });

      (overrides ?? []).forEach((o: any) => {
        if (o.override_team_id === t.id && !defaultIds.includes(o.player_id)) {
          movedIn.push({ id: o.player_id, name: pMap.get(o.player_id) ?? "—" });
          present.push({ id: o.player_id, name: pMap.get(o.player_id) ?? "—" });
        }
      });

      const teamRatings = (ratings ?? []).filter((r: any) => r.match_team_id === t.id);
      const ratingMap = new Map(teamRatings.map((r: any) => [r.player_id, r]));
      const potdRow = teamRatings.find((r: any) => r.player_of_the_day);
      const potd = potdRow
        ? { id: potdRow.player_id, name: pMap.get(potdRow.player_id) ?? "—" }
        : null;

      return {
        id: t.id,
        team_number: t.team_number,
        coaches: (t.match_team_coaches ?? [])
          .map((c: any) => c.coaches?.coach_name)
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
        hasRatings: teamRatings.length > 0,
        playerOfTheDay: potd,
      };
    });

    return {
      session: {
        id: (session as any).id,
        session_date: (session as any).session_date,
        session_type: (session as any).session_type,
        opponent: (session as any).opponent,
        venue: (session as any).venue,
      },
      teams: teamSummaries,
    };
  });

export const getMatchCompletion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;

    const { data: teams } = await sb
      .from("match_teams")
      .select(
        "id, team_number, match_team_coaches:match_team_coaches ( coaches:coach_id ( coach_name ) ), match_team_players:match_team_players ( player_id )",
      )
      .eq("session_id", data.session_id)
      .order("team_number", { ascending: true });

    const { data: overrides } = await sb
      .from("session_player_overrides")
      .select("player_id, override_team_id")
      .eq("session_id", data.session_id);
    const absent = new Set(
      (overrides ?? [])
        .filter((o: any) => o.override_team_id === null)
        .map((o: any) => o.player_id),
    );
    const movedTo = new Map<string, string>();
    (overrides ?? []).forEach((o: any) => {
      if (o.override_team_id) movedTo.set(o.player_id, o.override_team_id);
    });

    const { data: ratings } = await sb
      .from("skill_ratings")
      .select("player_id")
      .eq("session_id", data.session_id);
    const ratedSet = new Set((ratings ?? []).map((r: any) => r.player_id));

    const result = (teams ?? []).map((t: any) => {
      const defaultIds = (t.match_team_players ?? []).map((tp: any) => tp.player_id);
      const inTeam = new Set<string>();
      for (const pid of defaultIds) {
        if (absent.has(pid)) continue;
        const moved = movedTo.get(pid);
        if (moved && moved !== t.id) continue;
        inTeam.add(pid);
      }
      for (const [pid, tid] of movedTo) {
        if (tid === t.id) inTeam.add(pid);
      }
      const expected = inTeam.size;
      let rated = 0;
      for (const pid of inTeam) if (ratedSet.has(pid)) rated += 1;
      let status: "not_started" | "partial" | "submitted";
      if (rated === 0) status = "not_started";
      else if (rated >= expected) status = "submitted";
      else status = "partial";
      return {
        team_id: t.id,
        team_number: t.team_number,
        coaches: (t.match_team_coaches ?? [])
          .map((c: any) => c.coaches?.coach_name)
          .filter(Boolean) as string[],
        rated,
        expected,
        status,
      };
    });

    return { teams: result };
  });
