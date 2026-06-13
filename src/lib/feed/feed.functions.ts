import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getCoachName(context: any): Promise<string | null> {
  const { data } = await context.supabase
    .from("user_roles")
    .select("coaches:coach_id ( coach_name )")
    .eq("user_id", context.userId);
  const row = (data ?? []).find((r: any) => r.coaches);
  if (row?.coaches?.coach_name) return row.coaches.coach_name as string;
  // fallback to username from claims
  const meta = (context.claims as any)?.user_metadata?.username ?? null;
  const email = (context.claims as any)?.email ?? null;
  return meta ?? (email ? String(email).split("@")[0] : null);
}

async function assertCanEdit(context: any, written_by: string | null) {
  if (written_by && written_by === context.userId) return;
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "block_builder",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const listFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { limit?: number }) => input ?? {})
  .handler(async ({ context, data }) => {
    const limit = Math.min(Math.max(data?.limit ?? 100, 1), 200);
    const { data: rows, error } = await context.supabase
      .from("feed_posts")
      .select(
        "id, content, written_by, coach_name, player_id, is_player_note, source_note_id, created_at, updated_at, players:player_id ( id, player_name )",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      content: r.content,
      written_by: r.written_by,
      coach_name: r.coach_name,
      player_id: r.player_id,
      player_name: r.players?.player_name ?? null,
      is_player_note: r.is_player_note,
      source_note_id: r.source_note_id,
      created_at: r.created_at,
      updated_at: r.updated_at,
      canEdit: r.written_by === context.userId,
    }));
  });

export const createFeedPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ content: z.string().min(1).max(4000) }))
  .handler(async ({ context, data }) => {
    const coach_name = await getCoachName(context);
    const { error, data: row } = await context.supabase
      .from("feed_posts")
      .insert({
        content: data.content.trim(),
        written_by: context.userId,
        coach_name,
        is_player_note: false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateFeedPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), content: z.string().min(1).max(4000) }))
  .handler(async ({ context, data }) => {
    const { data: existing, error: e1 } = await context.supabase
      .from("feed_posts")
      .select("id, written_by, source_note_id, is_player_note")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    await assertCanEdit(context, (existing as any).written_by);
    const content = data.content.trim();
    const { error } = await context.supabase
      .from("feed_posts")
      .update({ content })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if ((existing as any).is_player_note && (existing as any).source_note_id) {
      await context.supabase
        .from("player_notes")
        .update({ note: content })
        .eq("id", (existing as any).source_note_id);
    }
    return { ok: true };
  });

export const deleteFeedPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: existing, error: e1 } = await context.supabase
      .from("feed_posts")
      .select("id, written_by, source_note_id, is_player_note")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    await assertCanEdit(context, (existing as any).written_by);
    if ((existing as any).is_player_note && (existing as any).source_note_id) {
      await context.supabase
        .from("player_notes")
        .delete()
        .eq("id", (existing as any).source_note_id);
    }
    const { error } = await context.supabase.from("feed_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPlayerNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ player_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("player_notes")
      .select("id, note, written_by, coach_name, created_at, updated_at")
      .eq("player_id", data.player_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      canEdit: r.written_by === context.userId,
    }));
  });

export const createPlayerNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ player_id: z.string().uuid(), note: z.string().min(1).max(4000) }))
  .handler(async ({ context, data }) => {
    const coach_name = await getCoachName(context);
    const note = data.note.trim();
    const { data: noteRow, error } = await context.supabase
      .from("player_notes")
      .insert({
        player_id: data.player_id,
        note,
        written_by: context.userId,
        coach_name,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const { error: e2 } = await context.supabase.from("feed_posts").insert({
      content: note,
      written_by: context.userId,
      coach_name,
      player_id: data.player_id,
      is_player_note: true,
      source_note_id: (noteRow as any).id,
    });
    if (e2) throw new Error(e2.message);
    return noteRow;
  });

export const updatePlayerNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), note: z.string().min(1).max(4000) }))
  .handler(async ({ context, data }) => {
    const { data: existing, error: e1 } = await context.supabase
      .from("player_notes")
      .select("id, written_by")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    await assertCanEdit(context, (existing as any).written_by);
    const note = data.note.trim();
    const { error } = await context.supabase
      .from("player_notes")
      .update({ note })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase
      .from("feed_posts")
      .update({ content: note })
      .eq("source_note_id", data.id);
    return { ok: true };
  });

export const deletePlayerNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: existing, error: e1 } = await context.supabase
      .from("player_notes")
      .select("id, written_by")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    await assertCanEdit(context, (existing as any).written_by);
    await context.supabase.from("feed_posts").delete().eq("source_note_id", data.id);
    const { error } = await context.supabase.from("player_notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getHomeSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const today = new Date().toISOString().slice(0, 10);

    const { data: block } = await sb
      .from("blocks")
      .select("id, name, block_number, start_date, end_date, is_active")
      .eq("is_active", true)
      .order("block_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    let myGroup: { id: string; group_number: number } | null = null;
    let myCoachId: string | null = null;
    const { data: roleRow } = await sb
      .from("user_roles")
      .select("coach_id")
      .eq("user_id", context.userId);
    myCoachId = (roleRow ?? []).find((r: any) => r.coach_id)?.coach_id ?? null;
    if (block && myCoachId) {
      const { data: gc } = await sb
        .from("group_coaches")
        .select("groups:group_id ( id, group_number, block_id )")
        .eq("coach_id", myCoachId);
      const g = (gc ?? [])
        .map((x: any) => x.groups)
        .find((g: any) => g?.block_id === (block as any).id);
      if (g) myGroup = { id: g.id, group_number: g.group_number };
    }

    const { data: nextSess } = await sb
      .from("sessions")
      .select("id, session_date, session_type, opponent, venue")
      .gte("session_date", today)
      .order("session_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: feed } = await sb
      .from("feed_posts")
      .select("id, content, coach_name, player_id, is_player_note, created_at, players:player_id ( player_name )")
      .order("created_at", { ascending: false })
      .limit(5);

    return {
      block: block ?? null,
      myGroup,
      nextSession: nextSess ?? null,
      feed: (feed ?? []).map((r: any) => ({
        id: r.id,
        content: r.content,
        coach_name: r.coach_name,
        player_id: r.player_id,
        player_name: r.players?.player_name ?? null,
        is_player_note: r.is_player_note,
        created_at: r.created_at,
      })),
    };
  });
