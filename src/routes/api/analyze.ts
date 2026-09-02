import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            path?: string;
            fileName?: string;
            contentType?: string;
            playerName?: string;
            jerseyNumber?: string;
            focusAreas?: string;
          };

          const path = String(body.path ?? "");
          if (!path.startsWith("uploads/") || path.includes("..")) {
            return Response.json({ error: "Invalid storage path" }, { status: 400 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { ensureIndex, createIndexingTask } = await import("@/lib/twelvelabs.server");

          const { data: blob, error: downloadError } = await supabaseAdmin.storage
            .from("videos")
            .download(path);
          if (downloadError || !blob) {
            return Response.json(
              { error: "Video not found in storage — the upload may not have finished." },
              { status: 400 },
            );
          }

          const contentType =
            typeof body.contentType === "string" && body.contentType.startsWith("video/")
              ? body.contentType
              : "video/mp4";
          const fileName = String(body.fileName ?? "video.mp4").slice(0, 200);
          const file = new File([blob], fileName, { type: contentType });

          const playerName = String(body.playerName ?? "").slice(0, 80) || "Unknown Player";
          const jerseyNumber = String(body.jerseyNumber ?? "").slice(0, 8) || null;
          const focusAreas = String(body.focusAreas ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8);

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
