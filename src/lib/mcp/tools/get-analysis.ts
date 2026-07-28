import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, supabaseForUser, text } from "../supabase";

export default defineTool({
  name: "get_video_analysis",
  title: "Get video analysis",
  description: "Get the full AI coaching report for one video: grade, summary, timestamped notes and category ratings.",
  inputSchema: { id: z.string().describe("Analysis id from list_video_analyses.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }: { id: string }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const { data, error } = await supabaseForUser(ctx)
      .from("video_analyses")
      .select("id, player_name, jersey_number, focus_areas, status, error_message, overall_grade, summary, notes, categories, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail(`No analysis found with id "${id}"`);
    return text(data);
  },
});
