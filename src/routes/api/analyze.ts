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
          const { ensureIndex, createIndexingTaskFromUrl } = await import("@/lib/twelvelabs.server");

          // Hand Twelve Labs a temporary download URL so we never stream the
          // whole video through this server (that is what stalled at 58%).
          const { data: signed, error: signError } = await supabaseAdmin.storage
            .from("videos")
            .createSignedUrl(path, 60 * 60 * 6);
          if (signError || !signed?.signedUrl) {
            return Response.json(
              { error: "Video not found in storage — the upload may not have finished." },
              { status: 400 },
            );
          }
          const base = process.env["SUPABASE_URL"]!.replace(/\/$/, "");
          const videoUrl = signed.signedUrl.startsWith("http")
            ? signed.signedUrl
            : `${base}/storage/v1${signed.signedUrl}`;

          const fileName = String(body.fileName ?? "video.mp4").slice(0, 200);
          const playerName = String(body.playerName ?? "").slice(0, 80) || "Unknown Player";
          const jerseyNumber = String(body.jerseyNumber ?? "").slice(0, 8) || null;
          const focusAreas = String(body.focusAreas ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8);

          const indexId = await ensureIndex();
          const taskId = await createIndexingTaskFromUrl(indexId, videoUrl);


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
