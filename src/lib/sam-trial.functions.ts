import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  boxToPixels,
  MAX_CLIP_SECONDS,
  type TrialBox,
  type SamFrame,
  type LkSample,
  type TrialLabels,
  type TrialMetrics,
} from "./sam-trial";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type SamTrialRecord = {
  id: string;
  analysisId: string;
  clipStart: number;
  clipEnd: number;
  fps: number;
  width: number;
  height: number;
  startBox: TrialBox;
  clipPath: string | null;
  falRequestId: string | null;
  status: string;
  outputPath: string | null;
  samTrack: SamFrame[] | null;
  lkTrack: LkSample[] | null;
  labels: TrialLabels | null;
  metrics: TrialMetrics | null;
  createdAt: string;
};

function toRecord(row: any): SamTrialRecord {
  return {
    id: row.id,
    analysisId: row.analysis_id,
    clipStart: row.clip_start,
    clipEnd: row.clip_end,
    fps: row.fps,
    width: row.width,
    height: row.height,
    startBox: row.start_box,
    clipPath: row.clip_path ?? null,
    falRequestId: row.fal_request_id ?? null,
    status: row.status,
    outputPath: row.output_path ?? null,
    samTrack: Array.isArray(row.sam_track) ? row.sam_track : null,
    lkTrack: Array.isArray(row.lk_track) ? row.lk_track : null,
    labels: row.labels && typeof row.labels === "object" ? row.labels : null,
    metrics: row.metrics && typeof row.metrics === "object" ? row.metrics : null,
    createdAt: row.created_at,
  };
}

const boxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0.01).max(1),
  h: z.number().min(0.01).max(1),
});

async function signedUrl(supabaseAdmin: any, path: string, seconds: number): Promise<string | null> {
  const { data: signed } = await supabaseAdmin.storage.from("videos").createSignedUrl(path, seconds);
  if (!signed?.signedUrl) return null;
  const base = process.env["SUPABASE_URL"]!.replace(/\/$/, "");
  return signed.signedUrl.startsWith("http") ? signed.signedUrl : `${base}/storage/v1${signed.signedUrl}`;
}

export const listSamTrials = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ analysisId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("sam_trials")
      .select("*")
      .eq("analysis_id", data.analysisId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return { items: [] as SamTrialRecord[], error: error.message };
    return { items: (rows ?? []).map(toRecord), error: null as string | null };
  });

export const createSamTrial = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        analysisId: z.string().uuid(),
        clipStart: z.number().min(0),
        clipEnd: z.number().min(0),
        fps: z.number().min(1).max(120),
        width: z.number().int().min(2),
        height: z.number().int().min(2),
        startBox: boxSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (data.clipEnd - data.clipStart < 1 || data.clipEnd - data.clipStart > MAX_CLIP_SECONDS) {
      throw new Error(`The test clip must be 1–${MAX_CLIP_SECONDS} seconds long.`);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: analysis } = await supabaseAdmin
      .from("video_analyses")
      .select("id")
      .eq("id", data.analysisId)
      .maybeSingle();
    if (!analysis) throw new Error("Clip not found");
    const { data: row, error } = await supabaseAdmin
      .from("sam_trials")
      .insert({
        analysis_id: data.analysisId,
        clip_start: data.clipStart,
        clip_end: data.clipEnd,
        fps: data.fps,
        width: data.width,
        height: data.height,
        start_box: data.startBox,
        status: "draft",
      })
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not create the trial");
    return { record: toRecord(row) };
  });

/** Signed upload URL so the browser can PUT the cut clip straight to storage. */
export const getTrialUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ trialId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `sam-trial/${data.trialId}.mp4`;
    const { data: signed, error } = await supabaseAdmin.storage.from("videos").createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not create upload URL");
    await supabaseAdmin.from("sam_trials").update({ clip_path: path, updated_at: new Date().toISOString() }).eq("id", data.trialId);
    const base = process.env["SUPABASE_URL"]!.replace(/\/$/, "");
    const uploadUrl = signed.signedUrl.startsWith("http") ? signed.signedUrl : `${base}/storage/v1${signed.signedUrl}`;
    return { path: signed.path, token: signed.token, uploadUrl };
  });

/** Send the cut clip + starting box to fal's SAM 2 queue. The key never leaves the server. */
export const submitSamTrial = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ trialId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const falKey = process.env["FAL_KEY"];
    if (!falKey) throw new Error("The tracking service key isn't configured yet.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: trial } = await supabaseAdmin.from("sam_trials").select("*").eq("id", data.trialId).maybeSingle();
    if (!trial?.clip_path) throw new Error("The cut clip hasn't been uploaded yet.");

    const videoUrl = await signedUrl(supabaseAdmin, trial.clip_path, 60 * 60 * 2);
    if (!videoUrl) throw new Error("Could not create a temporary link for the test clip.");

    const response = await fetch("https://queue.fal.run/fal-ai/sam2/video", {
      method: "POST",
      headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        video_url: videoUrl,
        box_prompts: [boxToPixels(trial.start_box, trial.width, trial.height)],
        boundingbox_zip: true,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as any;
    if (!response.ok || !body.request_id) {
      const detail = typeof body.detail === "string" ? body.detail : "The tracking service rejected the request.";
      await supabaseAdmin.from("sam_trials").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", data.trialId);
      return { error: detail };
    }
    await supabaseAdmin
      .from("sam_trials")
      .update({ fal_request_id: body.request_id, status: "submitted", updated_at: new Date().toISOString() })
      .eq("id", data.trialId);
    return { error: null as string | null };
  });

/** Check fal's queue; on completion, copy the mask video into private storage before fal's link expires. */
export const pollSamTrial = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ trialId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const falKey = process.env["FAL_KEY"];
    if (!falKey) throw new Error("The tracking service key isn't configured yet.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: trial } = await supabaseAdmin.from("sam_trials").select("*").eq("id", data.trialId).maybeSingle();
    if (!trial) throw new Error("Trial not found");
    if (trial.status !== "submitted" || !trial.fal_request_id) return { status: trial.status };

    const base = `https://queue.fal.run/fal-ai/sam2/requests/${trial.fal_request_id}`;
    const headers = { Authorization: `Key ${falKey}` };
    const statusRes = await fetch(`${base}/status`, { headers });
    if (!statusRes.ok) return { status: trial.status };
    const statusBody = (await statusRes.json().catch(() => ({}))) as any;
    const falStatus = statusBody.status as string | undefined;

    if (falStatus === "FAILED") {
      await supabaseAdmin.from("sam_trials").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", data.trialId);
      return { status: "failed" };
    }
    if (falStatus !== "COMPLETED") return { status: "submitted" };

    const resultRes = await fetch(base, { headers });
    const result = (await resultRes.json().catch(() => ({}))) as any;
    const maskUrl = result?.video?.url as string | undefined;
    if (!maskUrl) {
      await supabaseAdmin.from("sam_trials").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", data.trialId);
      return { status: "failed" };
    }
    const mask = await fetch(maskUrl);
    if (!mask.ok) return { status: "submitted" };
    const bytes = new Uint8Array(await mask.arrayBuffer());
    const outputPath = `sam-trial/${data.trialId}-mask.mp4`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("videos")
      .upload(outputPath, bytes, { contentType: "video/mp4", upsert: true });
    if (uploadError) return { status: "submitted" };
    await supabaseAdmin
      .from("sam_trials")
      .update({ status: "completed", output_path: outputPath, updated_at: new Date().toISOString() })
      .eq("id", data.trialId);
    return { status: "completed" };
  });

/** Temporary playback links for the cut clip and the SAM 2 mask video. */
export const getSamTrialUrls = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ trialId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: trial } = await supabaseAdmin.from("sam_trials").select("clip_path, output_path").eq("id", data.trialId).maybeSingle();
    if (!trial) return { clipUrl: null as string | null, maskUrl: null as string | null };
    const clipUrl = trial.clip_path ? await signedUrl(supabaseAdmin, trial.clip_path, 60 * 60 * 4) : null;
    const maskUrl = trial.output_path ? await signedUrl(supabaseAdmin, trial.output_path, 60 * 60 * 4) : null;
    return { clipUrl, maskUrl };
  });

const samFrameSchema = z.object({
  frame: z.number().int().min(0),
  time: z.number(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  area: z.number(),
  lost: z.boolean(),
});
const lkSampleSchema = z.object({ time: z.number(), x: z.number(), y: z.number(), w: z.number(), h: z.number(), lost: z.boolean() });

/** Save extracted tracks, labeling results and metrics onto the trial record only. */
export const saveSamTrialData = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        trialId: z.string().uuid(),
        samTrack: z.array(samFrameSchema).max(20000).optional(),
        lkTrack: z.array(lkSampleSchema).max(20000).optional(),
        labels: z.any().optional(),
        metrics: z.any().optional(),
        status: z.enum(["labeled"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.samTrack !== undefined) changes.sam_track = data.samTrack;
    if (data.lkTrack !== undefined) changes.lk_track = data.lkTrack;
    if (data.labels !== undefined) changes.labels = data.labels;
    if (data.metrics !== undefined) changes.metrics = data.metrics;
    if (data.status !== undefined) changes.status = data.status;
    const { error } = await supabaseAdmin.from("sam_trials").update(changes).eq("id", data.trialId);
    if (error) throw new Error("Could not save the trial data. Try again.");
    return { ok: true };
  });
