import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { identityDetailsSchema, evidenceSchema, shiftsSchema, marksSchema, type IdentityDetails, type IdentificationEvidence } from "./player-identification";
import { reviewSegmentsSchema, approvedWindows, type ReviewSegment } from "./video-review";

export type ClipMetrics = {
  topSpeedKph: number;
  avgSpeedKph: number;
  distanceCoveredM: number;
  shifts: number;
  puckTouches: number;
  movementNote: string;
  tendencyNote: string;
};

export type AnalysisRecord = {
  id: string;
  playerName: string;
  jerseyNumber: string | null;
  jerseyColor: string | null;
  teamName: string | null;
  position: string | null;
  handedness: string | null;
  playerIdentified: boolean | null;
  identityDetails: IdentityDetails;
  identificationEvidence: IdentificationEvidence | null;
  focusAreas: string[];
  fileName: string | null;
  status: string;
  errorMessage: string | null;
  overallGrade: string | null;
  summary: string | null;
  notes: Array<{ time: string; tag: string; type: string; text: string; evidence?: string; interpretation?: string; suggestion?: string; confidence?: string; visibility?: string }>;
  categories: Array<{ name: string; score: number; note: string }>;
  metrics: ClipMetrics | null;
  shifts: Array<{ start: number; end: number }>;
  marks: PlayerMark[];
  reviewSegments: ReviewSegment[];
  reviewApproved: boolean;
  createdAt: string;
};

export type PlayerMark = { time: number; x: number; y: number; w: number; h: number; referenceImage?: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRecord(row: any): AnalysisRecord {
  const metrics = row.metrics && typeof row.metrics === "object" && Object.keys(row.metrics).length
    ? (row.metrics as ClipMetrics)
    : null;
  return {
    id: row.id,
    playerName: row.player_name,
    jerseyNumber: row.jersey_number,
    jerseyColor: row.jersey_color ?? null,
    teamName: row.team_name ?? null,
    position: row.position ?? null,
    handedness: row.handedness ?? null,
    playerIdentified: row.player_identified ?? null,
    identityDetails: identityDetailsSchema.parse(row.identity_details ?? {}),
    identificationEvidence: evidenceSchema.safeParse(row.identification_evidence).success ? row.identification_evidence : null,
    focusAreas: row.focus_areas ?? [],
    fileName: row.file_name,
    status: row.status,
    errorMessage: row.error_message,
    overallGrade: row.overall_grade,
    summary: row.summary,
    notes: (row.notes ?? []) as AnalysisRecord["notes"],
    categories: (row.categories ?? []) as AnalysisRecord["categories"],
    metrics,
    shifts: Array.isArray(row.shifts) ? row.shifts : [],
    marks: Array.isArray(row.marks) ? row.marks : [],
    reviewSegments: reviewSegmentsSchema.safeParse(row.review_segments).data ?? [],
    reviewApproved: row.review_approved === true,
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
    const { advanceAnalysis } = await import("@/lib/analysis-worker.server");
    const { row, error } = await advanceAnalysis(data.id);
    return { record: row ? toRecord(row) : (null as AnalysisRecord | null), error };
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
/** Temporary playback link for an analysis's original footage. */
export const getVideoPlaybackUrl = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("video_analyses")
      .select("storage_path, file_name")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { url: null as string | null };
    let path = row.storage_path as string | null;
    if (!path && row.file_name) {
      // Older uploads didn't record the path; find it by file name.
      const { data: files } = await supabaseAdmin.storage.from("videos").list("uploads", { limit: 1000 });
      const match = files?.find((f) => f.name.endsWith(`-${row.file_name}`));
      if (match) {
        path = `uploads/${match.name}`;
        await supabaseAdmin.from("video_analyses").update({ storage_path: path }).eq("id", data.id);
      }
    }
    if (!path) return { url: null as string | null };
    const { data: signed } = await supabaseAdmin.storage.from("videos").createSignedUrl(path, 60 * 60 * 4);
    if (!signed?.signedUrl) return { url: null as string | null };
    const base = process.env["SUPABASE_URL"]!.replace(/\/$/, "");
    const url = signed.signedUrl.startsWith("http") ? signed.signedUrl : `${base}/storage/v1${signed.signedUrl}`;
    return { url };
  });

/** Save identification clues, boxes and shifts atomically before re-grading. */
export const savePlayerIdentification = createServerFn({ method: "POST" })
  .inputValidator(input => z.object({
    id: z.string().uuid(), details: identityDetailsSchema.optional(),
    shifts: shiftsSchema.optional(), marks: marksSchema.optional(), segments: reviewSegmentsSchema.optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("video_analyses").select("tl_video_id, status").eq("id", data.id).maybeSingle();
    if (!row) return { record: null as AnalysisRecord | null, error: "Analysis not found" };
    if (row.status === "analyzing") return { record: null as AnalysisRecord | null, error: "This clip is being analyzed. Wait for it to finish before changing identification." };
    const changes = {
      ...(data.details ? { identity_details: data.details } : {}),
      ...(data.shifts !== undefined ? { shifts: data.shifts, shifts_confirmed: true } : {}),
      ...(data.marks !== undefined ? { marks: data.marks } : {}),
      ...(data.segments !== undefined ? { review_segments: data.segments } : {}),
      status: "awaiting_review", review_approved: false, highlighted: false,
      error_message: null, overall_grade: null, summary: null, player_identified: null, identification_evidence: {}, notes: [], categories: [], metrics: {},
    };
    const { error: saveError } = await supabaseAdmin.from("video_analyses").update(changes).eq("id", data.id).eq("status", row.status).select("id").single();
    if (saveError) throw new Error("Could not save identification. Refresh the clip and try again.");
    const { data: saved } = await supabaseAdmin.from("video_analyses").select("*").eq("id", data.id).single();
    return { record: saved ? toRecord(saved) : null, error: null };
  });

/** Switch the AI to a user-approved copy of the clip with the target highlighted, then re-grade. */
export const sendHighlightedCopy = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid(), path: z.string().startsWith("uploads/").max(300), marks: marksSchema, shifts: shiftsSchema, details: identityDetailsSchema, segments: reviewSegmentsSchema, approved: z.literal(true) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureIndex, createIndexingTaskFromUrl } = await import("@/lib/twelvelabs.server");
    const { data: row } = await supabaseAdmin.from("video_analyses").select("status").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Clip not found");
    if (row.status === "analyzing") throw new Error("This clip is being analyzed. Wait for it to finish first.");
    if (!approvedWindows(data.segments, data.shifts, data.marks).length) throw new Error("Verify an on-ice section with a player box before sending.");
    if (data.path.includes("..")) throw new Error("Invalid video path");
    // Persist exactly the reviewed inputs before approval. The trigger invalidates stale approval.
    const { error: draftError } = await supabaseAdmin.from("video_analyses").update({
      marks: data.marks, shifts: data.shifts, shifts_confirmed: true, identity_details: data.details, review_segments: data.segments,
      status: "awaiting_review", review_approved: false,
    }).eq("id", data.id).eq("status", row.status).select("id").single();
    if (draftError) throw new Error("The clip changed. Save and review the copy again.");
    const { data: snapshot } = await supabaseAdmin.from("video_analyses").select("updated_at").eq("id", data.id).single();
    if (!snapshot) throw new Error("Clip not found");
    const { data: signed, error } = await supabaseAdmin.storage.from("videos").createSignedUrl(data.path, 60 * 60 * 6);
    if (error || !signed) throw new Error("Couldn't find the highlighted copy. Try again.");
    const indexId = await ensureIndex();
    const taskId = await createIndexingTaskFromUrl(indexId, signed.signedUrl);
    const { error: saveError } = await supabaseAdmin.from("video_analyses").update({
      highlighted_path: data.path, highlighted: true, review_approved: true,
      tl_index_id: indexId, tl_task_id: taskId, tl_video_id: null, status: "indexing", error_message: null,
      overall_grade: null, player_identified: null, identification_evidence: {}, notes: [], categories: [], metrics: {},
    }).eq("id", data.id).eq("updated_at", snapshot.updated_at).select("id").single();
    if (saveError) throw new Error("Couldn't save. Try again.");
    await supabaseAdmin.rpc("ensure_analysis_worker");
    return { ok: true };
  });
