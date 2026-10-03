// Player-move scenarios for the shared roster logic (src/lib/match/roster.ts).
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { teamRoster, planRegister } from "../src/lib/match/roster.ts";

type Row = Record<string, any>;

/** Tiny in-memory stand-in for the Supabase query builder calls teamRoster makes. */
function makeDb() {
  const db: Record<string, Row[]> = { players: [], match_team_players: [], session_player_overrides: [] };
  const sb = {
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      let sel = "";
      const b: any = {
        select(s: string) { sel = s; return b; },
        eq(c: string, v: unknown) { filters.push((r) => r[c] === v); return b; },
        in(c: string, v: unknown[]) { filters.push((r) => v.includes(r[c])); return b; },
        then(res: any, rej: any) {
          let rows = db[table].filter((r) => filters.every((f) => f(r)));
          if (sel.includes("players:player_id"))
            rows = rows.map((r) => ({ ...r, players: db.players.find((p) => p.id === r.player_id) }));
          return Promise.resolve({ data: rows, error: null }).then(res, rej);
        },
      };
      return b;
    },
  };
  return { db, sb };
}

const S = "match", T3 = "team3", T4 = "team4";

function setup() {
  const { db, sb } = makeDb();
  for (const id of ["a", "b", "theo", "x", "y"]) db.players.push({ id, player_name: id, is_active: true });
  for (const id of ["a", "b", "theo"]) db.match_team_players.push({ match_team_id: T3, player_id: id });
  for (const id of ["x", "y"]) db.match_team_players.push({ match_team_id: T4, player_id: id });

  async function confirm(team: string, entries: any[]) {
    const r = await teamRoster(sb, S, team);
    const plan = planRegister({
      sessionId: S, teamId: team, userId: "u",
      defaultIds: new Set(r.defaultPlayers.map((p: any) => p.id)), entries,
    });
    db.session_player_overrides = db.session_player_overrides.filter((o) => !plan.clear.includes(o.player_id));
    for (const u of plan.upserts) {
      db.session_player_overrides = db.session_player_overrides.filter((o) => o.player_id !== u.player_id);
      db.session_player_overrides.push(u);
    }
    return plan;
  }
  const playing = async (team: string) =>
    (await teamRoster(sb, S, team)).playing.map((p: any) => p.id).join(",");
  return { confirm, playing, sb };
}

const present = (id: string) => ({ player_id: id, status: "present" });
const absent = (id: string) => ({ player_id: id, status: "absent" });
const move = (id: string, to: string) => ({ player_id: id, status: "move", move_to_team_id: to });

test("move a player: leaves sending team, joins receiving team, old score removed", async () => {
  const t = setup();
  const plan = await t.confirm(T3, [present("a"), absent("b"), move("theo", T4)]);
  assert.equal(await t.playing(T3), "a");
  assert.equal(await t.playing(T4), "x,y,theo");
  assert.deepEqual(plan.notPlaying.sort(), ["b", "theo"]);
});

test("moved player stays on sending team's register so it can be undone", async () => {
  const t = setup();
  await t.confirm(T3, [present("a"), present("b"), move("theo", T4)]);
  const r = await teamRoster(t.sb, S, T3);
  assert.deepEqual(r.movedOut.map((p: any) => [p.id, p.moved_to_team_id]), [["theo", T4]]);
  assert.ok(r.defaultPlayers.some((p: any) => p.id === "theo"));
});

test("receiving team confirming keeps the moved-in player", async () => {
  const t = setup();
  await t.confirm(T3, [present("a"), present("b"), move("theo", T4)]);
  await t.confirm(T4, [present("x"), present("y"), present("theo")]);
  assert.equal(await t.playing(T4), "x,y,theo");
});

test("sending team can undo a move", async () => {
  const t = setup();
  await t.confirm(T3, [present("a"), present("b"), move("theo", T4)]);
  await t.confirm(T3, [present("a"), present("b"), present("theo")]);
  assert.equal(await t.playing(T3), "a,b,theo");
  assert.equal(await t.playing(T4), "x,y");
});

test("receiving team can send a player back", async () => {
  const t = setup();
  await t.confirm(T3, [present("a"), present("b"), move("theo", T4)]);
  await t.confirm(T4, [present("x"), present("y"), move("theo", T3)]);
  assert.equal(await t.playing(T3), "a,b,theo");
  assert.equal(await t.playing(T4), "x,y");
});

test("receiving team marking a moved-in player absent makes them absent", async () => {
  const t = setup();
  await t.confirm(T3, [present("a"), present("b"), move("theo", T4)]);
  await t.confirm(T4, [present("x"), present("y"), absent("theo")]);
  assert.equal(await t.playing(T3), "a,b");
  assert.equal(await t.playing(T4), "x,y");
  const r3 = await teamRoster(t.sb, S, T3);
  assert.deepEqual(r3.absent.map((p: any) => p.id), ["theo"]);
});
