import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { teamRoster, planRegister } from "@/lib/match/roster";

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

async function assertCanManageTeam(context: any, teamId: string) {
  const sb = context.supabase;
  const { data: team, error } = await sb
    .from("match_teams")
    .select(
      "id, match_team_coaches:match_team_coaches ( coach_id, coaches:coach_id ( coach_name ) )",
    )
    .eq("id", teamId)
    .single();
  if (error) throw new Error(error.message);
  const links = ((team as any).match_team_coaches ?? []) as any[];
  const coachIds = links.map((c) => c.coach_id).filter(Boolean) as string[];
  const coachNames = links.map((c) => c.coaches?.coach_name).filter(Boolean) as string[];
  const { data: isAdmin } = await sb.rpc("has_role", {
    _user_id: context.userId,
    _role: "block_builder",
  });
  const { data: myRole } = await sb
    .from("user_roles")
    .select("coach_id, coaches:coach_id ( coach_name )")
    .eq("user_id", context.userId)
    .not("coach_id", "is", null)
    .limit(1)
    .maybeSingle();
  const myCoachId = (myRole as any)?.coach_id as string | undefined;
  if (!isAdmin && !(myCoachId && coachIds.includes(myCoachId))) {
    throw new Error("Forbidden: you are not a coach for this team");
  }
  const myName =
    ((myRole as any)?.coaches?.coach_name as string | undefined) ??
    ((context as any).claims?.email as string | undefined) ??
    null;
  return { coachNames, myName };
}

/** Everything the Match Day register and scoring screens need for one team. */
export const getMatchDayContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ session_id: z.string().uuid(), team_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const roster = await teamRoster(sb, data.session_id, data.team_id);

    const { data: ratings, error: e4 } = await sb
      .from("skill_ratings")
      .select(
        "player_id, match_team_id, carrying, handling, tackling, rucking, kicking, iq, player_of_the_day",
      )
      .eq("session_id", data.session_id)
      .eq("match_team_id", data.team_id);
    if (e4) throw new Error(e4.message);

    const { data: reg } = await sb
      .from("session_registrations")
      .select("id")
      .eq("session_id", data.session_id)
      .eq("match_team_id", data.team_id)
      .maybeSingle();

    return {
      registered: !!reg,
      // Register shows the team sheet (incl. absent and moved-out, so they can be undone)
      defaultRoster: roster.defaultPlayers,
      movedInPlayers: roster.movedIn,
      movedOutPlayers: roster.movedOut,
      // Scoring shows only who played for this team
      playing: roster.playing,
      overrides: roster.overrides,
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
    await assertCanManageTeam(context, data.team_id);
    const roster = await teamRoster(context.supabase, data.session_id, data.team_id);

    // Only players on this team's sheet, or moved in to it, can be changed from its register.
    const allowed = new Set<string>([
      ...roster.defaultPlayers.map((p: any) => p.id),
      ...roster.movedIn.map((p: any) => p.id),
    ]);
    const defaultIds = new Set<string>(roster.defaultPlayers.map((p: any) => p.id));
    for (const e of data.entries) {
      if (!allowed.has(e.player_id))
        throw new Error("A player on this register isn't in this team");
      if (e.status === "move" && (!e.move_to_team_id || e.move_to_team_id === data.team_id)) {
        throw new Error("Choose which team to move the player to");
      }
    }
    if (data.entries.some((e) => e.status === "move")) {
      const { data: sessionTeams } = await context.supabase
        .from("match_teams")
        .select("id")
        .eq("session_id", data.session_id);
      const ids = new Set((sessionTeams ?? []).map((t: any) => t.id));
      if (data.entries.some((e) => e.status === "move" && !ids.has(e.move_to_team_id))) {
        throw new Error("That team isn't part of this match");
      }
    }

    const { upserts, clear, notPlaying } = planRegister({
      sessionId: data.session_id,
      teamId: data.team_id,
      userId: context.userId,
      defaultIds,
      entries: data.entries,
    });

    // Permission is checked above; write with the server client so a coach can update
    // overrides another coach created (e.g. accepting or sending back a moved player).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (clear.length) {
      const { error } = await supabaseAdmin
        .from("session_player_overrides")
        .delete()
        .eq("session_id", data.session_id)
        .in("player_id", clear);
      if (error) throw new Error(error.message);
    }
    if (upserts.length) {
      const { error } = await supabaseAdmin
        .from("session_player_overrides")
        .upsert(upserts, { onConflict: "session_id,player_id" });
      if (error) throw new Error(error.message);
    }

    // Anyone no longer playing for this team loses any score this team gave them.
    if (notPlaying.length) {
      const { error } = await supabaseAdmin
        .from("skill_ratings")
        .delete()
        .eq("session_id", data.session_id)
        .eq("match_team_id", data.team_id)
        .in("player_id", notPlaying);
      if (error) throw new Error(error.message);
    }

    const { error: regErr } = await supabaseAdmin.from("session_registrations").upsert(
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
    const { coachNames, myName } = await assertCanManageTeam(context, data.team_id);
    const sb = context.supabase;

    const { data: reg } = await sb
      .from("session_registrations")
      .select("id")
      .eq("session_id", data.session_id)
      .eq("match_team_id", data.team_id)
      .maybeSingle();
    if (!reg) throw new Error("Confirm the register before entering scores");

    const roster = await teamRoster(sb, data.session_id, data.team_id);
    const playing = new Map<string, any>(roster.playing.map((p: any) => [p.id, p]));
    const seen = new Set<string>();
    const rows = data.ratings
      .filter((r) => {
        if (!playing.has(r.player_id) || seen.has(r.player_id)) return false;
        seen.add(r.player_id);
        return true;
      })
      .map((r) => ({
        session_id: data.session_id,
        match_team_id: data.team_id,
        coach_names: coachNames,
        player_id: r.player_id,
        player_name: playing.get(r.player_id).player_name,
        tackling: r.tackling,
        rucking: r.rucking,
        carrying: r.carrying,
        handling: r.handling,
        kicking: r.kicking,
        iq: r.iq,
        player_of_the_day: r.player_id === data.player_of_the_day_id,
        entered_by: context.userId,
        entered_by_name: myName,
      }));
    if (data.player_of_the_day_id && !playing.has(data.player_of_the_day_id)) {
      throw new Error("Player of the Day must be someone who played for this team");
    }

    // Permission checked above. A player's score belongs to whichever team they played for,
    // so the server client is used in case an earlier score sits under another team.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (rows.length) {
      const { error } = await supabaseAdmin
        .from("skill_ratings")
        .upsert(rows, { onConflict: "session_id,player_id" });
      if (error) throw new Error(error.message);
    }
    // Only one Player of the Day per team.
    const { error: potdErr } = await supabaseAdmin
      .from("skill_ratings")
      .update({ player_of_the_day: false })
      .eq("session_id", data.session_id)
      .eq("match_team_id", data.team_id)
      .neq("player_id", data.player_of_the_day_id ?? "00000000-0000-0000-0000-000000000000");
    if (potdErr) throw new Error(potdErr.message);

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
        "id, team_number, match_team_coaches:match_team_coaches ( coaches:coach_id ( coach_name ) )",
      )
      .eq("session_id", data.session_id)
      .order("team_number", { ascending: true });
    const teamNumber = new Map<string, number>(
      (teams ?? []).map((t: any) => [t.id, t.team_number]),
    );

    const { data: ratings } = await sb
      .from("skill_ratings")
      .select(
        "player_id, match_team_id, tackling, rucking, carrying, handling, kicking, iq, player_of_the_day",
      )
      .eq("session_id", data.session_id);
    const { data: registrations } = await sb
      .from("session_registrations")
      .select("match_team_id")
      .eq("session_id", data.session_id);
    const registeredTeams = new Set((registrations ?? []).map((r: any) => r.match_team_id));

    const slim = (p: any) => ({ id: p.id as string, name: p.player_name as string });
    const teamSummaries = [];
    for (const t of teams ?? []) {
      const roster = await teamRoster(sb, data.session_id, (t as any).id);
      const teamRatings = (ratings ?? []).filter((r: any) => r.match_team_id === (t as any).id);
      const ratingMap = new Map(teamRatings.map((r: any) => [r.player_id, r]));
      const playing = roster.playing.map(slim);
      const potdRow = teamRatings.find((r: any) => r.player_of_the_day);
      teamSummaries.push({
        id: (t as any).id,
        team_number: (t as any).team_number,
        coaches: ((t as any).match_team_coaches ?? [])
          .map((c: any) => c.coaches?.coach_name)
          .filter(Boolean) as string[],
        registered: registeredTeams.has((t as any).id),
        // Own players who played, players moved in, absent, and moved out (with destination)
        present: roster.staying.map(slim),
        movedIn: roster.movedIn.map(slim),
        absent: roster.absent.map(slim),
        movedOut: roster.movedOut.map((p: any) => ({
          ...slim(p),
          toTeam: teamNumber.get(p.moved_to_team_id) ?? null,
        })),
        ratings: playing.map((p) => ({
          player_id: p.id,
          name: p.name,
          scores: ratingMap.get(p.id) ?? null,
        })),
        hasRatings: teamRatings.length > 0,
        ratedCount: playing.filter((p) => ratingMap.has(p.id)).length,
        playingCount: playing.length,
        playerOfTheDay: potdRow ? (playing.find((p) => p.id === potdRow.player_id) ?? null) : null,
      });
    }

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
        "id, team_number, match_team_coaches:match_team_coaches ( coaches:coach_id ( coach_name ) )",
      )
      .eq("session_id", data.session_id)
      .order("team_number", { ascending: true });
    const { data: ratings } = await sb
      .from("skill_ratings")
      .select("player_id, match_team_id")
      .eq("session_id", data.session_id);

    const result = [];
    for (const t of teams ?? []) {
      const roster = await teamRoster(sb, data.session_id, (t as any).id);
      // Only scores given by this team count towards this team.
      const ratedHere = new Set(
        (ratings ?? [])
          .filter((r: any) => r.match_team_id === (t as any).id)
          .map((r: any) => r.player_id),
      );
      const expected = roster.playing.length;
      const rated = roster.playing.filter((p: any) => ratedHere.has(p.id)).length;
      const status: "not_started" | "partial" | "submitted" =
        rated === 0 ? "not_started" : rated >= expected ? "submitted" : "partial";
      result.push({
        team_id: (t as any).id,
        team_number: (t as any).team_number,
        coaches: ((t as any).match_team_coaches ?? [])
          .map((c: any) => c.coaches?.coach_name)
          .filter(Boolean) as string[],
        rated,
        expected,
        status,
      });
    }
    return { teams: result };
  });
