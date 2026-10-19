import { useEffect, useState } from "react";
import { Loader2, Sparkles, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { createVideoUploadUrl, sendHighlightedCopy, type PlayerMark } from "@/lib/analysis.functions";

/** Lets the user preview and approve a copy of the clip with themselves highlighted before the AI sees it. */
export function HighlightEditor({ analysisId, videoUrl, marks, shifts, onSent }: {
  analysisId: string;
  videoUrl: string;
  marks: PlayerMark[];
  shifts: Array<{ start: number; end: number }>;
  onSent: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "rendering" | "review" | "sending">("idle");
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const getUploadUrl = useServerFn(createVideoUploadUrl);
  const send = useServerFn(sendHighlightedCopy);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const render = async () => {
    if (!marks.length) { toast.error("Box yourself on the video first."); return; }
    setPhase("rendering"); setProgress(0);
    try {
      const { renderHighlightedClip } = await import("@/lib/highlight");
      const out = await renderHighlightedClip(videoUrl, marks, shifts, setProgress);
      setFile(out); setPreview(URL.createObjectURL(out)); setPhase("review");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't make the highlighted copy.");
      setPhase("idle");
    }
  };
  const discard = () => { setFile(null); setPreview(null); setPhase("idle"); };
  const approve = async () => {
    if (!file) return;
    setPhase("sending");
    try {
      const upload = await getUploadUrl({ data: { fileName: `highlighted-${analysisId}.mp4`, contentType: "video/mp4" } });
      const res = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: file });
      if (!res.ok) throw new Error("Upload failed. Try again.");
      await send({ data: { id: analysisId, path: upload.path, marks: marks.map(({ referenceImage: _r, ...m }) => m), shifts } });
      toast.success("Sent your highlighted copy. The AI is re-grading it now.");
      discard();
      onSent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send the highlighted copy.");
      setPhase("review");
    }
  };

  return <section className="space-y-3 rounded-md border border-border p-4">
    <div>
      <h2 className="text-lg font-semibold">Highlight me before the AI sees it</h2>
      <p className="text-sm text-muted-foreground">Uses your boxes to paint a bright pink outline, ring and arrow on you. It glides between boxes up to 12 seconds apart and hides wherever there's no box nearby, so it never guesses. Watch it, then approve.</p>
    </div>
    {phase === "idle" && <Button onClick={render} disabled={!marks.length}><Sparkles className="size-4" />Make highlighted copy</Button>}
    {phase === "rendering" && <div className="space-y-2"><p className="text-sm">Painting the highlight… {Math.round(progress * 100)}%</p><Progress value={progress * 100} /></div>}
    {(phase === "review" || phase === "sending") && preview && <div className="space-y-3">
      <video src={preview} controls playsInline className="aspect-video w-full rounded-md bg-background" />
      <p className="text-sm text-muted-foreground">If the highlight lands on someone else, discard it, fix or add boxes at those moments, and make it again.</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={approve} disabled={phase === "sending"}>{phase === "sending" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Looks right — send to AI</Button>
        <Button variant="ghost" onClick={discard} disabled={phase === "sending"}><X className="size-4" />Discard</Button>
      </div>
    </div>}
  </section>;
}
