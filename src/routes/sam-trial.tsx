import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, Loader2, Play, Scan, Square, Flag, Pencil, Pause } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { getVideoPlaybackUrl, listAnalyses } from "@/lib/analysis.functions";
import {
  createSamTrial,
  getSamTrialUrls,
  getTrialUploadUrl,
  listSamTrials,
  pollSamTrial,
  saveSamTrialData,
  submitSamTrial,
  type SamTrialRecord,
} from "@/lib/sam-trial.functions";
import {
  checkpointTimes,
  computeMetrics,
  emptyLabels,
  frameToTime,
  passesBar,
  MAX_CLIP_SECONDS,
  MIN_MASK_AREA,
  type CheckpointLabel,
  type LkSample,
  type SamFrame,
  type TrialBox,
  type TrialLabels,
} from "@/lib/sam-trial";
import type { PlayerTracker } from "@/lib/player-tracker";

const title = "SAM 2 Tracking Trial (Experimental) | Hockey Video Analyzer";
const description =
  "Side-by-side test of SAM 2 player tracking against the current arrow tracker on one short clip. Trial data never affects grading.";

export const Route = createFileRoute("/sam-trial")({
  validateSearch: (search: Record<string, unknown>) => ({
    clip: typeof search.clip === "string" ? search.clip : undefined,
  }),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SamTrialPage,
});

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

type Phase = "setup" | "working" | "polling" | "extracting" | "compare" | "done";

function SamTrialPage() {
  const { clip } = Route.useSearch();
  const [analysisId, setAnalysisId] = useState<string | null>(clip ?? null);
  const [trial, setTrial] = useState<SamTrialRecord | null>(null);
  const [phase, setPhase] = useState<Phase>("setup");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const playback = useQuery({
    queryKey: ["playback", analysisId],
    queryFn: () => getVideoPlaybackUrl({ data: { id: analysisId as string } }),
    enabled: Boolean(analysisId),
    staleTime: 60 * 60 * 1000,
  });
  const videoUrl = playback.data?.url ?? null;

  const trials = useQuery({
    queryKey: ["sam-trials", analysisId],
    queryFn: () => listSamTrials({ data: { analysisId: analysisId as string } }),
    enabled: Boolean(analysisId),
  });

  const openTrial = (t: SamTrialRecord) => {
    setTrial(t);
    if (t.status === "completed" && t.samTrack && t.lkTrack && t.metrics) setPhase("done");
    else if (t.status === "completed" && t.samTrack) setPhase("compare");
    else if (t.status === "completed") setPhase("extracting");
    else if (t.status === "submitted") setPhase("polling");
    else setPhase("setup");
  };

  return (
    <PageShell title="Tracking trial" subtitle="Experimental — SAM 2 vs. the current arrow on one short clip. Nothing here changes grading.">
      {!analysisId ? (
        <ClipPicker onPick={setAnalysisId} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Button variant="ghost" size="sm" onClick={() => { setAnalysisId(null); setTrial(null); setPhase("setup"); }}>
              ← Pick another clip
            </Button>
            {(trials.data?.items ?? []).length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Previous trials:</span>
                {trials.data!.items.map((t) => (
                  <Button key={t.id} variant={trial?.id === t.id ? "secondary" : "outline"} size="sm" onClick={() => openTrial(t)}>
                    {fmt(t.clipStart)}–{fmt(t.clipEnd)} · {t.status}
                  </Button>
                ))}
                <Button variant="ghost" size="sm" onClick={() => { setTrial(null); setPhase("setup"); }}>New trial</Button>
              </div>
            )}
          </div>

          {phase === "setup" && videoUrl && (
            <SetupStep
              analysisId={analysisId}
              videoUrl={videoUrl}
              onCreated={(t) => { setTrial(t); setPhase("working"); }}
              onWorking={(msg, p) => { setMessage(msg); setProgress(p); }}
              onDone={(t) => { setTrial(t); setPhase("polling"); }}
            />
          )}
          {phase === "setup" && !videoUrl && (
            <p className="surface-card rounded-xl px-5 py-4 text-sm text-muted-foreground">
              {playback.isLoading ? "Loading footage…" : "This clip's footage isn't available for playback."}
            </p>
          )}
          {(phase === "working" || phase === "polling") && trial && (
            <WorkingStep
              trial={trial}
              phase={phase}
              progress={progress}
              message={message}
              onUpdate={(t) => setTrial(t)}
              onCompleted={() => setPhase("extracting")}
            />
          )}
          {phase === "extracting" && trial && (
            <ExtractStep
              trial={trial}
              onDone={(t) => { setTrial(t); setPhase("compare"); }}
            />
          )}
          {(phase === "compare" || phase === "done") && trial && (
            <CompareStep
              trial={trial}
              onDone={(t) => { setTrial(t); setPhase("done"); }}
            />
          )}
        </div>
      )}
    </PageShell>
  );
}

function ClipPicker({ onPick }: { onPick: (id: string) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ["analyses"], queryFn: () => listAnalyses() });
  const items = data?.items ?? [];
  return (
    <div className="surface-card rounded-2xl p-5">
      <h2 className="text-lg font-semibold">Pick a clip for the trial</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose footage where you're on the ice and cross paths with teammates in the same-colored jersey — that's the hard case we're testing.
      </p>
      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading your clips…</p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {items.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onPick(a.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {a.playerName || "Untitled clip"}
                    {a.jerseyNumber ? <span className="text-muted-foreground"> · #{a.jerseyNumber}</span> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {a.status}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Measure the letterboxed video frame inside its container so overlays align. */
function useVideoFrame(videoRef: RefObject<HTMLVideoElement | null>, containerRef: RefObject<HTMLDivElement | null>) {
  const [frame, setFrame] = useState({ left: 0, top: 0, width: 100, height: 100 });
  useEffect(() => {
    const v = videoRef.current;
    const container = containerRef.current;
    if (!v || !container) return;
    const measure = () => {
      if (!v.videoWidth || !v.videoHeight) return;
      const scale = Math.min(container.clientWidth / v.videoWidth, container.clientHeight / v.videoHeight);
      setFrame({
        left: (100 - (v.videoWidth * scale) / container.clientWidth * 100) / 2,
        top: (100 - (v.videoHeight * scale) / container.clientHeight * 100) / 2,
        width: (v.videoWidth * scale) / container.clientWidth * 100,
        height: (v.videoHeight * scale) / container.clientHeight * 100,
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    measure();
    v.addEventListener("loadedmetadata", measure);
    return () => { observer.disconnect(); v.removeEventListener("loadedmetadata", measure); };
  }, [videoRef, containerRef]);
  return frame;
}

/** Minimal box-drawing overlay (same interaction as the feedback page's box tool). */
function BoxDrawer({ videoRef, active, box, onBox }: {
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  box: TrialBox | null;
  onBox: (b: TrialBox | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frame = useVideoFrame(videoRef, containerRef);
  const origin = useRef<[number, number] | null>(null);
  const [draft, setDraft] = useState<TrialBox | null>(null);

  const point = (e: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };

  return (
    <svg
      aria-label="Draw a box around yourself"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ left: `${frame.left}%`, top: `${frame.top}%`, width: `${frame.width}%`, height: `${frame.height}%` }}
      className={`absolute ${active ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
      onPointerDown={(e) => { if (!active) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); origin.current = point(e); }}
      onPointerMove={(e) => {
        if (!origin.current) return;
        const [x1, y1] = origin.current, [x2, y2] = point(e);
        setDraft({ x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) });
      }}
      onPointerUp={() => {
        if (!origin.current) return;
        origin.current = null;
        const d = draft;
        setDraft(null);
        if (d && d.w >= 0.01 && d.h >= 0.01) onBox(d);
      }}
      onPointerCancel={() => { origin.current = null; setDraft(null); }}
    >
      {[box, draft].filter(Boolean).map((b, i) => (
        <rect key={i} x={b!.x * 100} y={b!.y * 100} width={b!.w * 100} height={b!.h * 100} fill="none" stroke="var(--color-ice)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

function SetupStep({ analysisId, videoUrl, onCreated, onWorking, onDone }: {
  analysisId: string;
  videoUrl: string;
  onCreated: (t: SamTrialRecord) => void;
  onWorking: (msg: string, p: number) => void;
  onDone: (t: SamTrialRecord) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(25);
  const [box, setBox] = useState<TrialBox | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createSamTrial);
  const getUploadUrl = useServerFn(getTrialUploadUrl);
  const submit = useServerFn(submitSamTrial);

  const cutClip = async (trialId: string): Promise<void> => {
    onWorking("Cutting your test clip on this device…", 5);
    const res = await fetch(videoUrl);
    const blob = await res.blob();
    const mb = await import("mediabunny");
    const input = new mb.Input({ source: new mb.BlobSource(blob), formats: mb.ALL_FORMATS });
    const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target: new mb.BufferTarget() });
    const conversion = await mb.Conversion.init({
      input,
      output,
      video: { height: 720, frameRate: 30, bitrate: 2_000_000 },
      audio: { discard: true },
      trim: { start, end: Math.min(start + length, start + MAX_CLIP_SECONDS) },
      showWarnings: false,
    });
    if (!conversion.isValid) throw new Error("This footage can't be cut in the browser.");
    conversion.onProgress = (p) => onWorking("Cutting your test clip on this device…", 5 + Math.round(p * 45));
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer || !buffer.byteLength) throw new Error("Cutting produced no video.");

    onWorking("Uploading the test clip…", 55);
    const upload = await getUploadUrl({ data: { trialId } });
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", upload.uploadUrl);
      xhr.setRequestHeader("Content-Type", "video/mp4");
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onWorking("Uploading the test clip…", 55 + Math.round((e.loaded / e.total) * 35)); };
      xhr.onload = () => (xhr.status < 400 ? resolve() : reject(new Error(`Upload failed (storage responded ${xhr.status}).`)));
      xhr.onerror = () => reject(new Error("The upload connection dropped. Try again."));
      xhr.send(new Blob([buffer], { type: "video/mp4" }));
    });

    onWorking("Sending to SAM 2…", 95);
    const result = await submit({ data: { trialId } });
    if (result.error) throw new Error(result.error);
  };

  const start2 = async () => {
    const v = videoRef.current;
    if (!v || !box || busy) return;
    if (!v.videoWidth) { toast.error("Wait for the video to load first."); return; }
    setBusy(true);
    try {
      const { record } = await create({
        data: {
          analysisId,
          clipStart: start,
          clipEnd: Math.min(start + length, v.duration || start + length),
          fps: 30,
          width: 1280,
          height: 720,
          startBox: box,
        },
      });
      onCreated(record);
      await cutClip(record.id);
      onDone({ ...record, status: "submitted" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the trial.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="surface-card rounded-2xl p-5">
        <h2 className="text-lg font-semibold">1 · Choose the stretch and box yourself</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a {MAX_CLIP_SECONDS}-second-or-shorter stretch where you cross paths with teammates. Seek the video to where the stretch should start, then draw a box around yourself on that first frame.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="start">Start (seconds)</Label>
            <Input id="start" type="number" min={0} step={0.5} value={start} onChange={(e) => setStart(Math.max(0, Number(e.target.value) || 0))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="length">Length (seconds, max {MAX_CLIP_SECONDS})</Label>
            <Input id="length" type="number" min={5} max={MAX_CLIP_SECONDS} value={length} onChange={(e) => setLength(Math.min(MAX_CLIP_SECONDS, Math.max(5, Number(e.target.value) || 25)))} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={() => { const v = videoRef.current; if (v) { v.pause(); setStart(Math.round(v.currentTime * 2) / 2); } }}>
              Use current time as start
            </Button>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="relative">
        <video
          ref={videoRef}
          crossOrigin="anonymous"
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          className="surface-card aspect-video w-full rounded-2xl bg-background"
        />
        <BoxDrawer videoRef={videoRef} active={drawing} box={box} onBox={(b) => { setBox(b); setDrawing(false); }} />
        {drawing && <div className="pointer-events-none absolute left-3 bottom-14 rounded-md bg-background/85 px-3 py-1 text-xs font-medium">Draw a box around yourself on the first frame</div>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant={drawing ? "secondary" : "outline"} size="sm" onClick={() => { const v = videoRef.current; if (v) { v.pause(); v.currentTime = start; } setDrawing(!drawing); }}>
          <Scan className="size-4" />{drawing ? "Cancel box" : box ? "Redraw box" : "Box yourself"}
        </Button>
        <Button onClick={start2} disabled={!box || busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
          {busy ? "Working…" : "Cut clip & run SAM 2"}
        </Button>
        {box && <span className="text-sm text-turf">Box set — ready to run.</span>}
      </div>
    </div>
  );
}

function WorkingStep({ trial, phase, progress, message, onUpdate, onCompleted }: {
  trial: SamTrialRecord;
  phase: Phase;
  progress: number;
  message: string | null;
  onUpdate: (t: SamTrialRecord) => void;
  onCompleted: () => void;
}) {
  const poll = useServerFn(pollSamTrial);
  useEffect(() => {
    if (phase !== "polling") return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const res = await poll({ data: { trialId: trial.id } });
        if (cancelled) return;
        if (res.status === "completed") { onUpdate({ ...trial, status: "completed" }); onCompleted(); }
        else if (res.status === "failed") { onUpdate({ ...trial, status: "failed" }); toast.error("SAM 2 failed on this clip. You can start a new trial."); }
      } catch { /* keep polling */ }
    }, 5000);
    return () => { cancelled = true; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, trial.id]);

  return (
    <div className="surface-card rounded-2xl p-6">
      <div className="flex items-center gap-3">
        {trial.status === "failed" ? <Flag className="size-5 text-gold" /> : <Loader2 className="size-5 animate-spin text-ice" />}
        <p className="text-sm text-muted-foreground">
          {trial.status === "failed"
            ? "The tracking run failed. Start a new trial to try again."
            : phase === "working"
              ? message ?? "Preparing your test clip…"
              : "SAM 2 is tracking your player — this usually takes 1–3 minutes. You can leave this page and come back."}
        </p>
      </div>
      {phase === "working" && <Progress value={progress} className="mt-4" />}
    </div>
  );
}

/** Play the mask video frame by frame onto a hidden canvas and measure the mask box per frame. */
function ExtractStep({ trial, onDone }: { trial: SamTrialRecord; onDone: (t: SamTrialRecord) => void }) {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const getUrls = useServerFn(getSamTrialUrls);
  const save = useServerFn(saveSamTrialData);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const { maskUrl } = await getUrls({ data: { trialId: trial.id } });
        if (!maskUrl) throw new Error("The tracking result isn't available yet. Wait a moment and reopen the trial.");

        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.muted = true;
        video.playsInline = true;
        video.src = maskUrl;
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error("Could not read the tracking result video."));
        });

        const frames = Math.round((trial.clipEnd - trial.clipStart) * trial.fps);
        const scale = 0.25;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(2, Math.round(trial.width * scale));
        canvas.height = Math.max(2, Math.round(trial.height * scale));
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas isn't available in this browser.");

        const track: SamFrame[] = [];
        for (let f = 0; f < frames; f++) {
          await new Promise<void>((resolve, reject) => {
            video.onseeked = () => resolve();
            video.onerror = () => reject(new Error("Failed while reading the tracking result."));
            video.currentTime = (f + 0.5) / trial.fps;
          });
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1, count = 0;
          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              const i = (y * canvas.width + x) * 4;
              if (data[i] + data[i + 1] + data[i + 2] > 60) {
                count++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
          const area = count / (canvas.width * canvas.height);
          const lost = count === 0 || area < MIN_MASK_AREA;
          track.push({
            frame: f,
            time: frameToTime(f, trial.fps, trial.clipStart),
            x: lost ? 0 : minX / canvas.width,
            y: lost ? 0 : minY / canvas.height,
            w: lost ? 0 : (maxX - minX + 1) / canvas.width,
            h: lost ? 0 : (maxY - minY + 1) / canvas.height,
            area,
            lost,
          });
          if (f % 30 === 0) setProgress(Math.round((f / frames) * 100));
        }
        await save({ data: { trialId: trial.id, samTrack: track } });
        onDone({ ...trial, samTrack: track });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read the tracking result.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trial.id]);

  return (
    <div className="surface-card rounded-2xl p-6">
      <div className="flex items-center gap-3">
        {error ? <Flag className="size-5 text-gold" /> : <Loader2 className="size-5 animate-spin text-ice" />}
        <p className="text-sm text-muted-foreground">{error ?? "Reading SAM 2's answer frame by frame…"}</p>
      </div>
      {!error && <Progress value={progress} className="mt-4" />}
    </div>
  );
}

function CompareStep({ trial, onDone }: { trial: SamTrialRecord; onDone: (t: SamTrialRecord) => void }) {
  const leftRef = useRef<HTMLVideoElement>(null);
  const rightRef = useRef<HTMLVideoElement>(null);
  const leftContainer = useRef<HTMLDivElement>(null);
  const rightContainer = useRef<HTMLDivElement>(null);
  const leftFrame = useVideoFrame(leftRef, leftContainer);
  const rightFrame = useVideoFrame(rightRef, rightContainer);

  const [urls, setUrls] = useState<{ clipUrl: string | null }>({ clipUrl: null });
  const [lkTrack, setLkTrack] = useState<LkSample[] | null>(trial.lkTrack);
  const [lkRunning, setLkRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [labels, setLabels] = useState<TrialLabels>(trial.labels ?? emptyLabels());
  const [labeling, setLabeling] = useState(false);
  const [currentCheckpoint, setCurrentCheckpoint] = useState<number | null>(null);
  const getUrls = useServerFn(getSamTrialUrls);
  const save = useServerFn(saveSamTrialData);

  const clipLength = trial.clipEnd - trial.clipStart;
  const checkpoints = checkpointTimes(trial.clipStart, trial.clipEnd);
  const samTrack = trial.samTrack ?? [];

  useEffect(() => {
    void getUrls({ data: { trialId: trial.id } }).then(setUrls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trial.id]);

  // Keep the right video roughly in sync with the left.
  useEffect(() => {
    const l = leftRef.current, r = rightRef.current;
    if (!l || !r) return;
    const sync = () => { if (Math.abs(r.currentTime - l.currentTime) > 0.3) r.currentTime = l.currentTime; };
    const onTime = () => { setTime(l.currentTime); sync(); };
    l.addEventListener("timeupdate", onTime);
    return () => l.removeEventListener("timeupdate", onTime);
  }, [urls.clipUrl]);

  const runArrow = async () => {
    const video = leftRef.current;
    if (!video || lkRunning) return;
    setLkRunning(true);
    try {
      const { PlayerTracker } = await import("@/lib/player-tracker");
      video.pause();
      video.currentTime = 0;
      await new Promise<void>((resolve) => { video.onseeked = () => resolve(); });
      const tracker: PlayerTracker = new PlayerTracker(video, trial.startBox);
      const samples: LkSample[] = [];
      let lostAt: number | null = null;
      let last = 0;
      await new Promise<void>((resolve) => {
        const tick = (_now: number, meta: VideoFrameCallbackMetadata) => {
          if (meta.mediaTime === last) { video.requestVideoFrameCallback(tick); return; }
          last = meta.mediaTime;
          if (lostAt === null) {
            const next = tracker.update(video);
            if (next) {
              samples.push({ time: trial.clipStart + meta.mediaTime, ...next, lost: false });
            } else {
              lostAt = meta.mediaTime;
            }
          }
          if (lostAt !== null) {
            samples.push({ time: trial.clipStart + meta.mediaTime, x: 0, y: 0, w: 0, h: 0, lost: true });
          }
          if (meta.mediaTime >= clipLength - 0.05 || video.ended) { resolve(); return; }
          video.requestVideoFrameCallback(tick);
        };
        video.onended = () => resolve();
        video.requestVideoFrameCallback(tick);
        void video.play();
      });
      video.pause();
      setLkTrack(samples);
      await save({ data: { trialId: trial.id, lkTrack: samples } });
      toast.success(lostAt === null ? "The arrow followed to the end of the clip." : `The arrow lost the player at ${fmt(trial.clipStart + lostAt)}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The arrow tracker couldn't start on this clip.");
    } finally {
      setLkRunning(false);
    }
  };

  // Labeling: pause at each unlabeled checkpoint.
  const startLabeling = () => {
    const v = leftRef.current;
    if (!v) return;
    setLabeling(true);
    v.currentTime = 0;
    void v.play();
  };
  useEffect(() => {
    if (!labeling) return;
    const v = leftRef.current;
    if (!v) return;
    let from = v.currentTime;
    const onTime = () => {
      const to = v.currentTime;
      const absFrom = trial.clipStart + from, absTo = trial.clipStart + to;
      from = to;
      const hit = checkpoints.find((t) => t > absFrom - 0.001 && t <= absTo && !labels.checkpoints[String(t)]?.sam);
      if (hit !== undefined && !v.seeking) {
        v.pause();
        rightRef.current?.pause();
        setCurrentCheckpoint(hit);
      }
    };
    const onSeeked = () => { from = v.currentTime; };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeked", onSeeked);
    return () => { v.removeEventListener("timeupdate", onTime); v.removeEventListener("seeked", onSeeked); };
  }, [labeling, labels, checkpoints, trial.clipStart]);

  const setLabel = (key: "sam" | "lk", value: CheckpointLabel) => {
    if (currentCheckpoint === null) return;
    const k = String(currentCheckpoint);
    const next: TrialLabels = {
      ...labels,
      checkpoints: { ...labels.checkpoints, [k]: { ...labels.checkpoints[k], [key]: value } },
    };
    setLabels(next);
  };

  const nextCheckpoint = async () => {
    if (currentCheckpoint === null) return;
    const next = { ...labels };
    setLabels(next);
    setCurrentCheckpoint(null);
    const remaining = checkpoints.filter((t) => !next.checkpoints[String(t)]?.sam || !next.checkpoints[String(t)]?.lk);
    if (!remaining.length) {
      setLabeling(false);
      const metrics = computeMetrics(next, trial.clipStart, trial.clipEnd);
      await save({ data: { trialId: trial.id, labels: next, metrics, status: "labeled" } });
      onDone({ ...trial, labels: next, metrics, lkTrack, status: "labeled" });
      return;
    }
    await save({ data: { trialId: trial.id, labels: next } });
    const v = leftRef.current;
    if (v) { void v.play(); void rightRef.current?.play(); }
  };

  const samBox = (() => {
    if (!samTrack.length) return null;
    const f = Math.min(samTrack.length - 1, Math.round(time * trial.fps));
    const s = samTrack[f];
    return s && !s.lost ? s : null;
  })();
  const lkBox = (() => {
    if (!lkTrack?.length) return null;
    const f = Math.min(lkTrack.length - 1, Math.round(time * trial.fps));
    const s = lkTrack[f];
    return s && !s.lost ? s : null;
  })();

  const metrics = trial.metrics;
  const bothLabeled = currentCheckpoint !== null && labels.checkpoints[String(currentCheckpoint)]?.sam && labels.checkpoints[String(currentCheckpoint)]?.lk;

  return (
    <div className="space-y-5">
      <div className="surface-card rounded-2xl p-5">
        <h2 className="text-lg font-semibold">2 · Watch both trackers side by side</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Left: the current arrow. Right: SAM 2's box. Run the arrow once, then do the labeling pass — the video pauses every 2 seconds and you mark what each tracker is on.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={runArrow} disabled={lkRunning || !urls.clipUrl}>
            {lkRunning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {lkTrack ? "Re-run arrow tracker" : "Run arrow tracker"}
          </Button>
          <Button size="sm" onClick={startLabeling} disabled={!lkTrack || labeling}>
            <Flag className="size-4" />Start labeling pass
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">Current arrow {lkBox ? "" : lkTrack ? "· lost here" : ""}</p>
          <div ref={leftContainer} className="relative">
            <video ref={leftRef} crossOrigin="anonymous" src={urls.clipUrl ?? undefined} controls playsInline preload="auto" className="surface-card aspect-video w-full rounded-2xl bg-background" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute" style={{ left: `${leftFrame.left}%`, top: `${leftFrame.top}%`, width: `${leftFrame.width}%`, height: `${leftFrame.height}%` }}>
              {lkBox && <rect x={lkBox.x * 100} y={lkBox.y * 100} width={lkBox.w * 100} height={lkBox.h * 100} fill="none" stroke="var(--color-gold)" strokeWidth={3} vectorEffect="non-scaling-stroke" />}
            </svg>
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">SAM 2 {samBox ? "" : "· lost here"}</p>
          <div ref={rightContainer} className="relative">
            <video ref={rightRef} crossOrigin="anonymous" src={urls.clipUrl ?? undefined} muted playsInline preload="auto" className="surface-card aspect-video w-full rounded-2xl bg-background" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute" style={{ left: `${rightFrame.left}%`, top: `${rightFrame.top}%`, width: `${rightFrame.width}%`, height: `${rightFrame.height}%` }}>
              {samBox && <rect x={samBox.x * 100} y={samBox.y * 100} width={samBox.w * 100} height={samBox.h * 100} fill="none" stroke="var(--color-turf)" strokeWidth={3} vectorEffect="non-scaling-stroke" />}
            </svg>
          </div>
        </div>
      </div>

      {currentCheckpoint !== null && (
        <div className="surface-card space-y-4 rounded-2xl p-5">
          <p className="font-medium">At {fmt(currentCheckpoint)} — what is each tracker on?</p>
          {(["sam", "lk"] as const).map((key) => (
            <div key={key} className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-sm font-medium">{key === "sam" ? "SAM 2" : "Arrow"}</span>
              {(["on_me", "wrong_player", "lost"] as const).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={labels.checkpoints[String(currentCheckpoint)]?.[key] === value ? "default" : "outline"}
                  onClick={() => setLabel(key, value)}
                >
                  {value === "on_me" ? "On me" : value === "wrong_player" ? "On wrong player" : "Lost"}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setLabels({ ...labels, corrections: { ...labels.corrections, [key]: labels.corrections[key] + 1 } })}>
                <Pencil className="size-3" />I redrew a box ({labels.corrections[key]})
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button
              size="sm"
              variant={labels.crossings.some((c) => Math.abs(c - currentCheckpoint) < 1) ? "secondary" : "outline"}
              onClick={() => {
                const exists = labels.crossings.some((c) => Math.abs(c - currentCheckpoint) < 1);
                setLabels({ ...labels, crossings: exists ? labels.crossings.filter((c) => Math.abs(c - currentCheckpoint) >= 1) : [...labels.crossings, currentCheckpoint] });
              }}
            >
              Players cross paths here
            </Button>
            <Button size="sm" onClick={nextCheckpoint} disabled={!bothLabeled}>
              {checkpoints.every((t) => t === currentCheckpoint || (labels.checkpoints[String(t)]?.sam && labels.checkpoints[String(t)]?.lk)) ? "Finish & see results" : "Next"}
            </Button>
          </div>
        </div>
      )}

      {labeling && currentCheckpoint === null && (
        <div className="surface-card flex items-center gap-3 rounded-2xl p-4 text-sm text-muted-foreground">
          <Pause className="size-4" />Playing — it will pause at the next checkpoint.
          <Button size="sm" variant="ghost" onClick={() => { leftRef.current?.pause(); rightRef.current?.pause(); setLabeling(false); }}><Square className="size-3" />Stop labeling</Button>
        </div>
      )}

      {metrics && (
        <div className="surface-card rounded-2xl p-5">
          <h2 className="text-lg font-semibold">3 · Results</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium"></th>
                  <th className="py-2 pr-4 font-medium">SAM 2</th>
                  <th className="py-2 font-medium">Current arrow</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">On me (coverage)</td>
                  <td className="py-2 pr-4">{Math.round(metrics.sam.coverage * 100)}%</td>
                  <td className="py-2">{Math.round(metrics.lk.coverage * 100)}%</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Identity switches</td>
                  <td className="py-2 pr-4">{metrics.sam.identitySwitches}</td>
                  <td className="py-2">{metrics.lk.identitySwitches}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Lost (checkpoints / seconds)</td>
                  <td className="py-2 pr-4">{metrics.sam.lostCount} / {metrics.sam.lostSeconds}s</td>
                  <td className="py-2">{metrics.lk.lostCount} / {metrics.lk.lostSeconds}s</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Boxes you redrew</td>
                  <td className="py-2 pr-4">{metrics.sam.corrections}</td>
                  <td className="py-2">{metrics.lk.corrections}</td>
                </tr>
                {metrics.sam.crossing && metrics.lk.crossing && (
                  <tr>
                    <td className="py-2 pr-4">At crossings: on me / switches</td>
                    <td className="py-2 pr-4">{Math.round(metrics.sam.crossing.coverage * 100)}% / {metrics.sam.crossing.identitySwitches}</td>
                    <td className="py-2">{Math.round(metrics.lk.crossing.coverage * 100)}% / {metrics.lk.crossing.identitySwitches}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm">
            {passesBar(metrics)
              ? "Verdict: SAM 2 clears the pass bar (85%+ on you, 20+ points ahead of the arrow, at most 1 switch at crossings). Worth building into the app."
              : "Verdict: SAM 2 does not clear the pass bar on this clip. The current review-and-box workflow stays the way to go."}
          </p>
        </div>
      )}
    </div>
  );
}
