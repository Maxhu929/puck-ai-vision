import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AnalysisRecord = {
  id: string;
  playerName: string;
  jerseyNumber: string | null;
  focusAreas: string[];
  fileName: string | null;
  status: string;
  errorMessage: string | null;
  overallGrade: string | null;
  summary: string | null;
  notes: Array<{ time: string; tag: string; type: string; text: string }>;
  categories: Array<{ name: string; score: number; note: string }>;
  createdAt: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRecord(row: any): AnalysisRecord {
  return {
    id: row.id,
    playerName: row.player_name,
    jerseyNumber: row.jersey_number,
    focusAreas: row.focus_areas ?? [],
    fileName: row.file_name,
    status: row.status,
    errorMessage: row.error_message,
    overallGrade: row.overall_grade,
    summary: row.summary,
    notes: (row.notes ?? []) as AnalysisRecord["notes"],
    categories: (row.categories ?? []) as AnalysisRecord["categories"],
    createdAt: row.created_at,
  };
}

/**
 * Mint a signed upload URL so the browser can send large videos (up to the
 * 2 GB bucket limit) straight to storage, bypassing the app server's ~100 MB
 * request-body cap.
 */
export const createVideoUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        fileName: z.string().min(1).max(200),
        contentType: z.string().max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.fileName.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `uploads/${crypto.randomUUID()}-${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("videos")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not create upload URL");
    const base = process.env["SUPABASE_URL"]!.replace(/\/$/, "");
    const uploadUrl = signed.signedUrl.startsWith("http")
      ? signed.signedUrl
      : `${base}/storage/v1${signed.signedUrl}`;
    return { path: signed.path, token: signed.token, uploadUrl };
  });

export const listAnalyses = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("video_analyses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) return { items: [] as AnalysisRecord[], error: error.message };
  return { items: (data ?? []).map(toRecord), error: null as string | null };
});

/**
 * Poll one analysis: advances indexing -> analyzing -> ready, running the
 * Twelve Labs analysis once the video has finished indexing.
 */
export const refreshAnalysis = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getTask, analyzeVideo } = await import("@/lib/twelvelabs.server");

    const { data: row, error } = await supabaseAdmin
      .from("video_analyses")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) return { record: null as AnalysisRecord | null, error: "Analysis not found" };
    if (row.status === "ready" || row.status === "failed") {
      return { record: toRecord(row), error: null as string | null };
    }

    try {
      let videoId = row.tl_video_id as string | null;

      if (!videoId) {
        const task = await getTask(row.tl_task_id as string);
        if (task.status === "failed") {
          const { data: failed } = await supabaseAdmin
            .from("video_analyses")
            .update({ status: "failed", error_message: "Indexing failed at Twelve Labs" })
            .eq("id", row.id)
            .select("*")
            .single();
          return { record: toRecord(failed), error: null as string | null };
        }
        if (task.status !== "ready" || !task.videoId) {
          return { record: toRecord({ ...row, status: task.status }), error: null as string | null };
        }
        videoId = task.videoId;
        await supabaseAdmin
          .from("video_analyses")
          .update({ tl_video_id: videoId, status: "analyzing" })
          .eq("id", row.id);
      }

      const analysis = await analyzeVideo(videoId, row.focus_areas ?? []);
      const { data: done, error: updateError } = await supabaseAdmin
        .from("video_analyses")
        .update({
          status: "ready",
          overall_grade: analysis.overallGrade,
          summary: analysis.summary,
          notes: analysis.notes,
          categories: analysis.categories,
        })
        .eq("id", row.id)
        .select("*")
        .single();
      if (updateError) throw updateError;
      return { record: toRecord(done), error: null as string | null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      console.error("refreshAnalysis failed:", message);
      const { data: failed } = await supabaseAdmin
        .from("video_analyses")
        .update({ status: "failed", error_message: message.slice(0, 500) })
        .eq("id", row.id)
        .select("*")
        .single();
      return { record: failed ? toRecord(failed) : null, error: message };
    }
  });

export const getAnalysis = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("video_analyses")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    return { record: row ? toRecord(row) : null };
  });