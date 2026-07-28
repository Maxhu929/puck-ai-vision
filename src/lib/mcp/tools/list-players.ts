import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, supabaseForUser, text } from "../supabase";

export default defineTool({
  name: "list_players",
  title: "List players",
  description: "List hockey players ranked by AI grade, with team, position and stat line.",
  inputSchema: { limit: z.number().int().min(1).max(50).optional().describe("Max players to return (default 20).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }: { limit?: number }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const { data, error } = await supabaseForUser(ctx)
      .from("players")
      .select("slug, name, team, position, location, grade, radar, stats")
      .order("grade", { ascending: false })
      .limit(limit ?? 20);
    if (error) return fail(error.message);
    return text({ players: data });
  },
});
