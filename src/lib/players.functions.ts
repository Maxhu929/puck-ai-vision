import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PlayerRecord = {
  id: string;
  slug: string;
  name: string;
  team: string;
  position: string;
  location: string;
  grade: number;
  radar: { metric: string; value: number }[];
  stats: Record<string, string>;
};

export type GameRecord = { game: string; grade: number; speed: number | null };

/* eslint-disable @typescript-eslint/no-explicit-any */
function toPlayer(row: any): PlayerRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    team: row.team,
    position: row.position,
    location: row.location,
    grade: row.grade,
    radar: (row.radar ?? []) as PlayerRecord["radar"],
    stats: (row.stats ?? {}) as Record<string, string>,
  };
}

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init?: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** All players ordered by AI grade — powers the leaderboard and compare pages. */
export const listPlayers = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = await publicClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, slug, name, team, position, location, grade, radar, stats")
    .order("grade", { ascending: false });
  if (error) return { players: [] as PlayerRecord[], error: error.message };
  return { players: (data ?? []).map(toPlayer), error: null as string | null };
});

/** Game-by-game grade log for the grade trend chart. */
export const listPlayerGames = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = await publicClient();
  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("slug", "you")
    .maybeSingle();
  if (!player) return { games: [] as GameRecord[] };
  const { data } = await supabase
    .from("player_games")
    .select("game_label, grade, top_speed")
    .eq("player_id", (player as any).id)
    .order("game_label", { ascending: true });
  return {
    games: (data ?? []).map((g: any) => ({
      game: g.game_label,
      grade: g.grade,
      speed: g.top_speed === null ? null : Number(g.top_speed),
    })),
  };
});

/** Game-by-game log for a specific player. */
export const getPlayerGames = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ playerId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = await publicClient();
    const { data: rows } = await supabase
      .from("player_games")
      .select("game_label, grade, top_speed")
      .eq("player_id", data.playerId)
      .order("played_on", { ascending: true });
    return {
      games: (rows ?? []).map((g: any) => ({
        game: g.game_label,
        grade: g.grade,
        speed: g.top_speed === null ? null : Number(g.top_speed),
      })),
    };
  });
