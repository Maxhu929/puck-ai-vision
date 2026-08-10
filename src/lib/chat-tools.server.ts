import { tool } from "ai";
import { z } from "zod";
import { listPlayers, getPlayerGames, type PlayerRecord } from "@/lib/players.functions";
import { listAnalyses, getAnalysis } from "@/lib/analysis.functions";
import { buildNutritionPlan, mealSplit, activityLevels, goals } from "@/lib/nutrition";
import { suggestGear, estimateHipHeight, stances, shotStyles } from "@/lib/gear";
import { suggestDrills } from "@/lib/drills";

function normalizePlayer(
  players: PlayerRecord[],
  identifier?: string
): { player: PlayerRecord | undefined; games?: Awaited<ReturnType<typeof getPlayerGames>>["games"] } {
  if (!identifier) {
    return { player: players[0] };
  }
  const player = players.find(
    (p) =>
      p.id === identifier ||
      p.slug === identifier ||
      p.name.toLowerCase() === identifier.toLowerCase()
  );
  return { player };
}

export function createChatTools() {
  return {
    list_players: tool({
      description: "List all hockey players in the database with their grade and basic info.",
      inputSchema: z.object({}),
      execute: async () => {
        const { players, error } = await listPlayers();
        if (error) return { error };
        return {
          players: players.map((p) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            team: p.team,
            position: p.position,
            location: p.location,
            grade: p.grade,
          })),
        };
      },
    }),

    get_player: tool({
      description:
        "Get detailed info about a player: profile, stats, skill radar, and recent game log. Provide the player's id, slug, or name.",
      inputSchema: z.object({
        identifier: z.string().describe("Player id, slug, or name"),
      }),
      execute: async ({ identifier }) => {
        const { players, error } = await listPlayers();
        if (error) return { error };
        const { player } = normalizePlayer(players, identifier);
        if (!player) return { error: "Player not found" };
        const { games } = await getPlayerGames({ data: { playerId: player.id } });
        return {
          player: {
            id: player.id,
            slug: player.slug,
            name: player.name,
            team: player.team,
            position: player.position,
            location: player.location,
            grade: player.grade,
            radar: player.radar,
            stats: player.stats,
            games,
          },
        };
      },
    }),

    list_video_analyses: tool({
      description: "List the most recent AI video analysis submissions.",
      inputSchema: z.object({
        limit: z.number().default(10).describe("Maximum number of analyses to return"),
      }),
      execute: async ({ limit }) => {
        const { items, error } = await listAnalyses();
        if (error) return { error };
        return {
          analyses: items.slice(0, limit).map((a) => ({
            id: a.id,
            playerName: a.playerName,
            status: a.status,
            overallGrade: a.overallGrade,
            summary: a.summary,
            focusAreas: a.focusAreas,
            createdAt: a.createdAt,
          })),
        };
      },
    }),

    get_video_analysis: tool({
      description: "Get the full AI coaching report for a specific video analysis.",
      inputSchema: z.object({
        id: z.string().uuid().describe("UUID of the video analysis"),
      }),
      execute: async ({ id }) => {
        const { record } = await getAnalysis({ data: { id } });
        if (!record) return { error: "Analysis not found" };
        return { analysis: record };
      },
    }),

    calculate_nutrition: tool({
      description:
        "Calculate a hockey player's daily calories, macros, water intake, and meal timing. Use metric units.",
      inputSchema: z.object({
        weightKg: z.number().describe("Body weight in kilograms"),
        heightCm: z.number().describe("Height in centimeters"),
        age: z.number().describe("Age in years"),
        sex: z.enum(["male", "female"]).describe("Biological sex"),
        activity: z
          .enum(["off", "light", "practice", "double", "gameday"])
          .describe("Training day intensity"),
        goal: z.enum(["cut", "maintain", "gain"]).describe("Body composition goal"),
      }),
      execute: ({ weightKg, heightCm, age, sex, activity, goal }) => {
        const plan = buildNutritionPlan({ weightKg, heightCm, age, sex, activity, goal });
        const meals = mealSplit(plan);
        return {
          plan: {
            bmr: plan.bmr,
            tdee: plan.tdee,
            calories: plan.calories,
            protein: plan.protein,
            carbs: plan.carbs,
            fat: plan.fat,
            waterLiters: plan.waterLiters,
            preGameCarbs: plan.preGameCarbs,
            postGameProtein: plan.postGameProtein,
          },
          meals,
          activityLabel: activityLevels.find((a) => a.key === activity)?.label ?? activity,
          goalLabel: goals.find((g) => g.key === goal)?.label ?? goal,
        };
      },
    }),

    suggest_gear: tool({
      description:
        "Suggest hockey stick specs: kick point, stick length, flex, blade pattern, and lie. Either provide a measured hip height or give height and stance so it can be estimated.",
      inputSchema: z.object({
        heightCm: z.number().describe("Player height in centimeters"),
        weightKg: z.number().describe("Player weight in kilograms"),
        stance: z.enum(["upright", "medium", "crouched"]).describe("Skating stance"),
        position: z.enum(["forward", "defense"]).describe("Primary position"),
        style: z.enum(["quick", "hybrid", "power"]).describe("Shooting style"),
        handedness: z.enum(["left", "right"]).describe("Shooting hand"),
        hipHeightCm: z.number().optional().describe("Optional measured floor-to-hip height in cm"),
      }),
      execute: ({ heightCm, weightKg, stance, position, style, handedness, hipHeightCm }) => {
        const hipHeight = hipHeightCm ?? estimateHipHeight(heightCm, stance);
        const suggestion = suggestGear({
          heightCm,
          hipHeightCm: hipHeight,
          weightKg,
          position,
          style,
          stance,
          handedness,
        });
        return {
          hipHeightCm: hipHeight,
          stanceLabel: stances.find((s) => s.key === stance)?.label ?? stance,
          styleLabel: shotStyles.find((s) => s.key === style)?.label ?? style,
          suggestion,
        };
      },
    }),

    suggest_drills: tool({
      description:
        "Suggest on-ice drills to improve a player based on the skill categories from a video analysis.",
      inputSchema: z.object({
        categories: z
          .array(
            z.object({
              name: z.string(),
              score: z.number(),
              note: z.string().optional(),
            })
          )
          .describe("Category scores from a video analysis"),
        limit: z.number().default(3).describe("Number of drills to return"),
      }),
      execute: ({ categories, limit }) => {
        const drills = suggestDrills(categories, limit);
        return { drills };
      },
    }),
  };
}
