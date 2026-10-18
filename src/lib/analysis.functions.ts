import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { identityDetailsSchema, evidenceSchema, shiftsSchema, marksSchema, type IdentityDetails, type IdentificationEvidence } from "./player-identification";

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
  notes: Array<{ time: string; tag: string; type: string; text: string }>;
  categories: Array<{ name: string; score: number; note: string }>;
  metrics: ClipMetrics | null;
  shifts: Array<{ start: number; end: number }>;
  marks: PlayerMark[];
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
    shifts: shiftsSchema.optional(), marks: marksSchema.optional(),
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
      ...(row.tl_video_id ? { status: "pending", error_message: null, overall_grade: null, player_identified: null, identification_evidence: {}, notes: [], categories: [], metrics: {} } : {}),
    };
    const { error: saveError } = await supabaseAdmin.from("video_analyses").update(changes).eq("id", data.id).eq("status", row.status).select("id").single();
    if (saveError) throw new Error("Could not save identification. Refresh the clip and try again.");
    await supabaseAdmin.rpc("ensure_analysis_worker");
    if (!row.tl_video_id) return { record: null as AnalysisRecord | null, error: "Identification saved; it will be used when processing finishes." };
    const { data: saved } = await supabaseAdmin.from("video_analyses").select("*").eq("id", data.id).single();
    return { record: saved ? toRecord(saved) : null, error: null };
  });
