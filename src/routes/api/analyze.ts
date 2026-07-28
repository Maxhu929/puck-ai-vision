import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File) || file.size === 0) {
            return Response.json({ error: "No video file provided" }, { status: 400 });
          }
          if (!file.type.startsWith("video/")) {
            return Response.json({ error: "File must be a video" }, { status: 400 });
          }

          const playerName = String(form.get("playerName") ?? "").slice(0, 80) || "Unknown Player";
          const jerseyNumber = String(form.get("jerseyNumber") ?? "").slice(0, 8) || null;
          const focusAreas = String(form.get("focusAreas") ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8);

          const { ensureIndex, createIndexingTask } = await import("@/lib/twelvelabs.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const indexId = await ensureIndex();
          const taskId = await createIndexingTask(indexId, file);

          const { data, error } = await supabaseAdmin
            .from("video_analyses")
            .insert({
              player_name: playerName,
              jersey_number: jerseyNumber,
              focus_areas: focusAreas,
              file_name: file.name,
              tl_index_id: indexId,
              tl_task_id: taskId,
              status: "indexing",
            })
            .select("id")
            .single();

          if (error) throw error;
          return Response.json({ id: data.id, taskId });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          console.error("analyze upload failed:", message);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});