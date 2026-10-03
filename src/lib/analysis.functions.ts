import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  focusAreas: string[];
  fileName: string | null;
  status: string;
  errorMessage: string | null;
  overallGrade: string | null;
  summary: string | null;
  notes: Array<{ time: string; tag: string; type: string; text: string }>;
  categories: Array<{ name: string; score: number; note: string }>;
  metrics: ClipMetrics | null;
  createdAt: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRecord(row: any): AnalysisRecord {
  const metrics = row.metrics && typeof row.metrics === "object" && Object.keys(row.metrics).length
    ? (row.metrics as ClipMetrics)
    : null;
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
    metrics,
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