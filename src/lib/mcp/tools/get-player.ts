import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, supabaseForUser, text } from "../supabase";

export default defineTool({
  name: "get_player",
  title: "Get player",
  description: "Get one player's full profile, skill radar and game log by slug.",
  inputSchema: { slug: z.string().describe("Player slug, e.g. from list_players.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }: { slug: string }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data: player, error } = await supabase
      .from("players")
      .select("id, slug, name, team, position, location, grade, radar, stats")
      .eq("slug", slug)
      .maybeSingle();
    if (error) return fail(error.message);
    if (!player) return fail(`No player found with slug "${slug}"`);
    const { data: games } = await supabase
      .from("player_games")
      .select("game, grade, speed")
      .eq("player_id", (player as { id: string }).id);
    return text({ player, games: games ?? [] });
  },
});
