import { useEffect, useState } from "react";
import { Loader2, Sparkles, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { createVideoUploadUrl, sendHighlightedCopy, type PlayerMark } from "@/lib/analysis.functions";
import { approvedWindows, type ReviewSegment } from "@/lib/video-review";
import type { IdentityDetails } from "@/lib/player-identification";
import { listSamTrials } from "@/lib/sam-trial.functions";
import { samReviewSchema, samHighlightAt, coachingWindows, type SamReview } from "@/lib/sam-review";

/** Lets the user preview and approve a copy of the clip with themselves highlighted before the AI sees it. */
export function HighlightEditor({ analysisId, videoUrl, marks, shifts, segments, details, onSent }: {
  analysisId: string;
  videoUrl: string;
  marks: PlayerMark[];
  shifts: Array<{ start: number; end: number }>;
  segments: ReviewSegment[];
  details: IdentityDetails;
  onSent: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "rendering" | "review" | "sending">("idle");
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [renderedKey, setRenderedKey] = useState<string | null>(null);
  const [watched, setWatched] = useState(false);
  const [tracks, setTracks] = useState<SamReview[]>([]);
  const [selected, setSelected] = useState<SamReview | null>(null);
  const listTracks = useServerFn(listSamTrials);
  useEffect(() => {
    let active = true;
    void listTracks({ data: { analysisId } }).then(result => {
      if (!active) return;
      setTracks(result.items.flatMap(t => {
        const parsed = samReviewSchema.safeParse({ trialId: t.id, fps: t.fps, clipStart: t.clipStart, clipEnd: t.clipEnd, frames: t.samTrack });
        return parsed.success ? [parsed.data] : [];
      }));
    }).catch(() => { if (active) setTracks([]); });
    return () => { active = false; };
  }, [analysisId, listTracks]);
  const inputKey = JSON.stringify({ marks, shifts, segments, details, selected });
  const windows = coachingWindows(segments, shifts, marks, selected);
  const stale = renderedKey !== inputKey;
  const getUploadUrl = useServerFn(createVideoUploadUrl);
  const send = useServerFn(sendHighlightedCopy);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const render = async () => {
    if (!marks.length) { toast.error("Box yourself on the video first."); return; }
    if (!windows.length) { toast.error("Mark a boxed on-ice section as verified first."); return; }
    setPhase("rendering"); setProgress(0);
    try {
      const { renderHighlightedClip } = await import("@/lib/highlight");
      const out = await renderHighlightedClip(videoUrl, marks, shifts, setProgress, windows, selected ? time => samHighlightAt(selected, time) : undefined);
      setRenderedKey(inputKey); setWatched(false);
      setFile(out); setPreview(URL.createObjectURL(out)); setPhase("review");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't make the highlighted copy.");
      setPhase("idle");
    }
  };
  const discard = () => { setFile(null); setPreview(null); setPhase("idle"); };
  const approve = async () => {
    if (!file || stale || !watched) return;
    setPhase("sending");
    try {
      const upload = await getUploadUrl({ data: { fileName: `highlighted-${analysisId}.mp4`, contentType: "video/mp4" } });
      const res = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: file });
      if (!res.ok) throw new Error("Upload failed. Try again.");
      await send({ data: { id: analysisId, path: upload.path, marks, shifts, details, segments, approved: true, ...(selected ? { samTrialId: selected.trialId, samReview: selected } : {}) } });
      toast.success("Sent your highlighted copy. The AI is re-grading it now.");
      discard();
      onSent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send the highlighted copy.");
      setPhase("review");
    }
  };

  return <section className="space-y-3 border-t border-border pt-5">
    <div>
      <h2 className="text-lg font-semibold">Approve footage for coaching</h2>
      <p className="text-sm text-muted-foreground">{windows.reduce((sum, w) => sum + w.end - w.start, 0).toFixed(1)} seconds eligible · {selected ? "SAM 2 highlights — approval required" : "Manual box highlights"}</p>
    </div>
    {tracks.length > 0 && phase === "idle" && <div className="space-y-2">
      <label htmlFor="coaching-track" className="text-sm font-medium">Player marker</label>
      <select id="coaching-track" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={selected?.trialId ?? "manual"} onChange={e => setSelected(tracks.find(t => t.trialId === e.target.value) ?? null)}>
        <option value="manual">Manual boxes</option>
        {tracks.map((t, i) => <option key={t.trialId} value={t.trialId}>SAM 2 trial {i + 1} · {t.clipStart.toFixed(1)}–{t.clipEnd.toFixed(1)}s</option>)}
      </select>
    </div>}
    {phase === "idle" && <Button onClick={render} disabled={!windows.length}><Sparkles className="size-4" />Make reviewed copy</Button>}
    {phase === "rendering" && <div className="space-y-2"><p className="text-sm">Painting the highlight… {Math.round(progress * 100)}%</p><Progress value={progress * 100} /></div>}
    {(phase === "review" || phase === "sending") && preview && <div className="space-y-3">
      <video src={preview} controls playsInline onEnded={() => setWatched(true)} className="aspect-video w-full rounded-md bg-background" />
      {stale && <p className="text-sm text-destructive">Your edits changed. Discard this copy and make a new one.</p>}
      <p className="text-sm text-muted-foreground">Excluded footage is blank; the original video clock is preserved.</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={approve} disabled={phase === "sending" || stale || !watched}>{phase === "sending" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Looks right — send to AI</Button>
        <Button variant="ghost" onClick={discard} disabled={phase === "sending"}><X className="size-4" />Discard</Button>
      </div>
    </div>}
  </section>;
}
