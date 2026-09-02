const BASE = "https://api.twelvelabs.io/v1.3";
const INDEX_NAME = "hockey-video-analyzer";

function apiKey() {
  const key = process.env.TWELVELABS_API_KEY;
  if (!key) throw new Error("TWELVELABS_API_KEY is not configured");
  return key;
}

async function tl(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "x-api-key": apiKey(), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Twelve Labs ${path} failed [${res.status}]: ${text}`);
    throw new Error(`Twelve Labs request failed [${res.status}]: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

/** Find the shared hockey index, creating it on first use. */
export async function ensureIndex(): Promise<string> {
  const list = await tl(`/indexes?index_name=${encodeURIComponent(INDEX_NAME)}&page_limit=1`);
  const existing = list?.data?.[0]?._id ?? list?.data?.[0]?.id;
  if (existing) return existing as string;

  const created = await tl("/indexes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      index_name: INDEX_NAME,
      models: [
        { model_name: "pegasus1.2", model_options: ["visual", "audio"] },
        { model_name: "marengo3.0", model_options: ["visual", "audio"] },
      ],
    }),
  });
  return (created._id ?? created.id) as string;
}

/** Start indexing from a publicly reachable video URL. Returns the task id. */
export async function createIndexingTaskFromUrl(indexId: string, videoUrl: string): Promise<string> {
  const form = new FormData();
  form.append("index_id", indexId);
  form.append("video_url", videoUrl);
  const task = await tl("/tasks", { method: "POST", body: form });
  return (task._id ?? task.id) as string;
}

/** Upload a video file and start indexing. Returns the task id. */
export async function createIndexingTask(indexId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("index_id", indexId);
  form.append("video_file", file, file.name || "upload.mp4");
  const task = await tl("/tasks", { method: "POST", body: form });
  return (task._id ?? task.id) as string;
}

export async function getTask(taskId: string) {
  const task = await tl(`/tasks/${taskId}`);
  return {
    status: String(task.status ?? "pending"),
    videoId: (task.video_id ?? task.videoId ?? null) as string | null,
  };
}

export type HockeyAnalysis = {
  overallGrade: string;
  summary: string;
  notes: Array<{ time: string; tag: string; type: "positive" | "improvement"; text: string }>;
  categories: Array<{ name: string; score: number; note: string }>;
};

const PROMPT = `You are an elite hockey skills coach reviewing this video.
Return ONLY valid JSON (no markdown fences) matching exactly:
{
  "overallGrade": "letter grade such as A-, B+",
  "summary": "2-3 sentence coaching summary of the player's performance",
  "notes": [{"time":"MM:SS","tag":"short play label","type":"positive|improvement","text":"one sentence of specific coaching feedback"}],
  "categories": [{"name":"Skating","score":0-100,"note":"one short sentence"}]
}
Include 5-10 notes with real timestamps taken from the footage, and exactly these categories:
Skating, Puck Control, Shot Selection, Positioning, Hockey IQ.`;

/** Ask Pegasus for structured hockey coaching feedback on an indexed video. */
export async function analyzeVideo(videoId: string, focus: string[]): Promise<HockeyAnalysis> {
  const focusLine = focus.length ? `\nPay special attention to: ${focus.join(", ")}.` : "";
  const result = await tl("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_id: videoId,
      prompt: PROMPT + focusLine,
      temperature: 0.2,
      stream: false,
    }),
  });

  const raw = String(result.data ?? result.text ?? "").trim();
  const json = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = json.indexOf("{");
  const end = json.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Analysis returned no structured result");

  const parsed = JSON.parse(json.slice(start, end + 1)) as Partial<HockeyAnalysis>;
  return {
    overallGrade: parsed.overallGrade ?? "B",
    summary: parsed.summary ?? "",
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    categories: Array.isArray(parsed.categories) ? parsed.categories : [],
  };
}