import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Send, X, Crosshair, SkipForward } from "lucide-react";
import { BoxDrawer } from "@/components/BoxDrawer";
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
export function HighlightEditor({ analysisId, videoUrl, marks: savedMarks, shifts, segments, details, onSent }: {
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
  const [fixes, setFixes] = useState<PlayerMark[]>([]);
  const marks = fixes.length ? [...savedMarks, ...fixes] : savedMarks;
  const [lostAt, setLostAt] = useState<number[]>([]);
  const [handled, setHandled] = useState<number[]>([]);
  const [reboxAt, setReboxAt] = useState<number | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const previewBox = useRef<HTMLDivElement>(null);
  const lastTime = useRef(0);
  const pending = lostAt.filter(t => !handled.includes(t));
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
      const { file: out, lostAt: lost } = await renderHighlightedClip(videoUrl, marks, shifts, setProgress, windows, selected ? time => samHighlightAt(selected, time) : undefined);
      setRenderedKey(inputKey); setWatched(false); setLostAt(lost); setHandled([]); setReboxAt(null); lastTime.current = 0;
      setFile(out); setPreview(URL.createObjectURL(out)); setPhase("review");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't make the highlighted copy.");
      setPhase("idle");
    }
  };
  const discard = () => { setFile(null); setPreview(null); setPhase("idle"); setLostAt([]); setReboxAt(null); };
  const approve = async () => {
    if (!file || stale || !watched || pending.length) return;
    setPhase("sending");
    try {
      const upload = await getUploadUrl({ data: { fileName: `highlighted-${analysisId}.mp4`, contentType: "video/mp4" } });
      const res = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: file });
      if (!res.ok) throw new Error("Upload failed. Try again.");
      await send({ data: { id: analysisId, path: upload.path, marks, shifts, details, segments, approved: true, ...(selected ? { samTrialId: selected.trialId, samReview: selected } : {}) } });
      toast.success("Sent your highlighted copy. The AI is re-grading it now.");
      discard(); setFixes([]);
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
      <div ref={previewBox} className="relative">
        <video ref={previewRef} src={preview} controls playsInline onEnded={() => setWatched(true)} onSeeking={() => { lastTime.current = previewRef.current?.currentTime ?? 0; }}
          onPlay={() => { if (reboxAt !== null) previewRef.current?.pause(); }}
          onTimeUpdate={() => {
            const v = previewRef.current; if (!v) return;
            const prev = lastTime.current, now = v.currentTime; lastTime.current = now;
            if (v.paused || now < prev || now - prev > 1) return;
            const hit = pending.find(t => t > prev - 0.01 && t <= now + 0.01);
            if (hit !== undefined) { v.pause(); v.currentTime = hit; setReboxAt(hit); }
          }}
          className="aspect-video w-full rounded-md bg-background" />
        {reboxAt !== null && <BoxDrawer videoRef={previewRef} containerRef={previewBox} active box={null} onBox={b => {
          if (!b) return;
          setFixes(f => [...f, { time: reboxAt, ...b }]);
          setHandled(h => [...h, ...lostAt.filter(t => Math.abs(t - reboxAt) < 0.05)]);
          setReboxAt(null);
          toast.success("Rebox saved. Keep watching, then remake the copy.");
        }} />}
      </div>
      {reboxAt !== null ? <div className="space-y-2 rounded-md border border-gold/50 bg-gold/10 p-3 text-sm">
        <p><strong>The box may have lost you at {reboxAt.toFixed(1)}s.</strong> Draw a new box around yourself on the video{lostAt.includes(reboxAt) ? ", or skip if it's still on you" : ""}.</p>
        <Button size="sm" variant="ghost" onClick={() => { setHandled(h => [...h, reboxAt]); setReboxAt(null); void previewRef.current?.play(); }}><SkipForward className="size-4" />{lostAt.includes(reboxAt) ? "It's on me — skip" : "Cancel"}</Button>
      </div> : <Button size="sm" variant="outline" onClick={() => { const v = previewRef.current; if (!v) return; v.pause(); setReboxAt(v.currentTime); }}><Crosshair className="size-4" />Box is off me — rebox here</Button>}
      {pending.length > 0 && reboxAt === null && <p className="text-sm text-gold">The video will pause {pending.length} time{pending.length > 1 ? "s" : ""} where the box looks empty. Rebox or skip each one.</p>}
      {fixes.length > 0 && <Button onClick={render}><Sparkles className="size-4" />Remake copy with {fixes.length} rebox{fixes.length > 1 ? "es" : ""}</Button>}
      {stale && <p className="text-sm text-destructive">Your boxes changed. Make the copy again before sending.</p>}
      <p className="text-sm text-muted-foreground">Excluded footage is blank; the original video clock is preserved.</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={approve} disabled={phase === "sending" || stale || !watched || pending.length > 0}>{phase === "sending" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Looks right — send to AI</Button>
        <Button variant="ghost" onClick={discard} disabled={phase === "sending"}><X className="size-4" />Discard</Button>
      </div>
    </div>}
  </section>;
}
