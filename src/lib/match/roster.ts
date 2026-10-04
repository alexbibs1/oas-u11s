// Pure match-day roster logic, shared by register, scoring, summary and completion.
// Kept free of server/framework imports so it can be tested on its own.

const PLAYER_FIELDS =
  "id, player_name, is_active, tackling, rucking, carrying, handling, kicking, iq, speed, strength, repeatability";

/**
 * Where every relevant player stands for one team in one match.
 *  - default:   picked for this team on the team sheet
 *  - movedIn:   picked for another team, moved to this one on a register
 *  - movedOut:  picked for this team, moved to another team (with target)
 *  - absent:    picked for this team, marked absent
 *  - playing:   who this team rates = default not absent/moved out + moved in
 */
export async function teamRoster(sb: any, sessionId: string, teamId: string) {
  const { data: picked, error: e1 } = await sb
    .from("match_team_players")
    .select(`player_id, players:player_id ( ${PLAYER_FIELDS} )`)
    .eq("match_team_id", teamId);
  if (e1) throw new Error(e1.message);
  const { data: overrides, error: e2 } = await sb
    .from("session_player_overrides")
    .select("player_id, override_team_id")
    .eq("session_id", sessionId);
  if (e2) throw new Error(e2.message);

  const ovByPid = new Map<string, string | null>(
    (overrides ?? []).map((o: any) => [o.player_id, o.override_team_id]),
  );
  const byName = (a: any, b: any) => a.player_name.localeCompare(b.player_name);
  const defaultPlayers = (picked ?? [])
    .map((r: any) => r.players)
    .filter((p: any) => p && p.is_active !== false)
    .sort(byName);
  const defaultIds = new Set<string>(defaultPlayers.map((p: any) => p.id));

  const absent: any[] = [];
  const movedOut: any[] = [];
  const staying: any[] = [];
  for (const p of defaultPlayers) {
    if (!ovByPid.has(p.id)) staying.push(p);
    else {
      const target = ovByPid.get(p.id);
      if (target === null) absent.push(p);
      else if (target === teamId) staying.push(p);
      else movedOut.push({ ...p, moved_to_team_id: target });
    }
  }

  const movedInIds = (overrides ?? [])
    .filter((o: any) => o.override_team_id === teamId && !defaultIds.has(o.player_id))
    .map((o: any) => o.player_id);
  let movedIn: any[] = [];
  if (movedInIds.length) {
    const { data: pl, error: e3 } = await sb
      .from("players")
      .select(PLAYER_FIELDS)
      .in("id", movedInIds)
      .eq("is_active", true);
    if (e3) throw new Error(e3.message);
    movedIn = (pl ?? []).sort(byName);
  }

  return {
    defaultPlayers,
    staying,
    absent,
    movedOut,
    movedIn,
    playing: [...staying, ...movedIn],
    overrides: overrides ?? [],
  };
}

export type RegisterEntry = {
  player_id: string;
  status: "present" | "absent" | "move";
  move_to_team_id?: string | null;
};

/**
 * Turn a confirmed register into override changes.
 *  - present own player: clear any override
 *  - present moved-in player: override to this team (accepts them)
 *  - absent: override to null
 *  - move: override to the chosen team
 * notPlaying lists players whose score from this team should be removed.
 */
export function planRegister(args: {
  sessionId: string;
  teamId: string;
  userId: string;
  defaultIds: Set<string>;
  entries: RegisterEntry[];
}) {
  const upserts: Array<{
    session_id: string;
    player_id: string;
    override_team_id: string | null;
    created_by: string;
  }> = [];
  const clear: string[] = [];
  for (const e of args.entries) {
    if (e.status === "present") {
      if (args.defaultIds.has(e.player_id)) clear.push(e.player_id);
      else
        upserts.push({
          session_id: args.sessionId,
          player_id: e.player_id,
          override_team_id: args.teamId,
          created_by: args.userId,
        });
    } else {
      upserts.push({
        session_id: args.sessionId,
        player_id: e.player_id,
        override_team_id: e.status === "absent" ? null : (e.move_to_team_id ?? null),
        created_by: args.userId,
      });
    }
  }
  const notPlaying = args.entries.filter((e) => e.status !== "present").map((e) => e.player_id);
  return { upserts, clear, notPlaying };
}
