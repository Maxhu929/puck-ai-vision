import { useEffect, useState } from "react";
import { Loader2, Sparkles, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { createVideoUploadUrl, sendHighlightedCopy, type PlayerMark } from "@/lib/analysis.functions";
import { approvedWindows, type ReviewSegment } from "@/lib/video-review";
import type { IdentityDetails } from "@/lib/player-identification";

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
  const inputKey = JSON.stringify({ marks, shifts, segments, details });
  const windows = approvedWindows(segments, shifts, marks);
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
      const out = await renderHighlightedClip(videoUrl, marks, shifts, setProgress, windows);
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
      await send({ data: { id: analysisId, path: upload.path, marks, shifts, details, segments, approved: true } });
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
      <p className="text-sm text-muted-foreground">{windows.reduce((sum, w) => sum + w.end - w.start, 0).toFixed(1)} seconds eligible · Manual box highlights, not automatic tracking.</p>
    </div>
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
