import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, supabaseForUser, text } from "../supabase";

export default defineTool({
  name: "list_video_analyses",
  title: "List video analyses",
  description: "List recent hockey video submissions and their AI analysis status.",
  inputSchema: { limit: z.number().int().min(1).max(50).optional().describe("Max submissions to return (default 10).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }: { limit?: number }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const { data, error } = await supabaseForUser(ctx)
      .from("video_analyses")
      .select("id, player_name, jersey_number, focus_areas, status, overall_grade, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (error) return fail(error.message);
    return text({ analyses: data });
  },
});
