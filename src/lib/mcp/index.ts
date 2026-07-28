import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getAnalysisTool from "./tools/get-analysis";
import getPlayerTool from "./tools/get-player";
import listAnalysesTool from "./tools/list-analyses";
import listPlayersTool from "./tools/list-players";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "hockey-iq-mcp",
  title: "Hockey IQ Analyzer",
  version: "0.1.0",
  instructions:
    "Tools for the AI hockey video analyzer. Use `list_players` and `get_player` for leaderboard, skill radar and stat data; `list_video_analyses` and `get_video_analysis` for AI coaching reports on uploaded game footage.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listPlayersTool, getPlayerTool, listAnalysesTool, getAnalysisTool],
});
