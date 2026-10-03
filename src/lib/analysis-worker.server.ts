/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getTask, analyzeVideo } from "@/lib/twelvelabs.server";

/**
 * Advance one analysis: indexing -> analyzing -> ready/failed. Shared by the
 * in-page poll and the background cron worker, so processing finishes even
 * when nobody has the app open.
 */
export async function advanceAnalysis(id: string): Promise<{ row: any | null; error: string | null }> {
  const { data: row, error } = await supabaseAdmin.from("video_analyses").select("*").eq("id", id).maybeSingle();
  if (error || !row) return { row: null, error: "Analysis not found" };
  if (row.status === "ready" || row.status === "failed") return { row, error: null };

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
        await notifyComplete(failed);
        return { row: failed, error: null };
      }
      if (task.status !== "ready" || !task.videoId) return { row: { ...row, status: task.status }, error: null };
      videoId = task.videoId;
      // Claim the row so a parallel poll/cron doesn't analyze twice.
      const { data: claimed } = await supabaseAdmin
        .from("video_analyses")
        .update({ tl_video_id: videoId, status: "analyzing" })
        .eq("id", row.id)
        .is("tl_video_id", null)
        .select("id");
      if (!claimed?.length) return { row: { ...row, status: "analyzing" }, error: null };
    } else if (row.status === "analyzing") {
      // Already being analyzed by another worker.
      const ageMs = Date.now() - new Date(row.updated_at ?? row.created_at).getTime();
      if (ageMs < 10 * 60 * 1000) return { row, error: null };
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
        metrics: (analysis.metrics ?? {}) as any,
      })
      .eq("id", row.id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    await notifyComplete(done);
    return { row: done, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("advanceAnalysis failed:", message);
    const { data: failed } = await supabaseAdmin
      .from("video_analyses")
      .update({ status: "failed", error_message: message.slice(0, 500) })
      .eq("id", row.id)
      .select("*")
      .single();
    if (failed) await notifyComplete(failed);
    return { row: failed ?? null, error: message };
  }
}

/** Process every pending analysis (called by the background cron). */
export async function processPending(limit = 5) {
  const { data } = await supabaseAdmin
    .from("video_analyses")
    .select("id")
    .in("status", ["indexing", "pending", "analyzing"])
    .order("created_at", { ascending: true })
    .limit(limit);
  const results = [];
  for (const r of data ?? []) {
    const { row } = await advanceAnalysis(r.id);
    results.push({ id: r.id, status: row?.status ?? "unknown" });
  }
  const { count } = await supabaseAdmin
    .from("video_analyses")
    .select("id", { count: "exact", head: true })
    .in("status", ["indexing", "pending", "analyzing"]);
  if (!count) await supabaseAdmin.rpc("stop_analysis_worker");
  return results;
}

/**
 * Email the player when their analysis finishes. Sending activates once an
 * email sender domain is configured; until then the row stays un-notified so
 * it can be sent later.
 */
async function notifyComplete(row: any) {
  if (!row?.notify_email || row.notified_at) return;
  console.log(`analysis ${row.id} finished (${row.status}); email to ${row.notify_email} pending sender domain setup`);
}
