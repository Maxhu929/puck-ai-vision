import { useState, type RefObject } from "react";
import { CheckCircle2, EyeOff, AlertTriangle, UserX, Trash2, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reviewSegmentSchema, reviewedWindows, type ReviewSegment } from "@/lib/video-review";
import { toast } from "sonner";

const labels = { verified: "Verified player", uncertain: "Uncertain identity", offscreen: "Off-screen", wrong_player: "Wrong player" };
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export function VideoReview({ segments, onChange, shifts, videoRef, onSave, saving }: {
  segments: ReviewSegment[]; onChange: (segments: ReviewSegment[]) => void;
  shifts: Array<{ start: number; end: number }>; videoRef: RefObject<HTMLVideoElement | null>;
  onSave: () => void; saving: boolean;
}) {
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("10");
  const add = (status: ReviewSegment["status"]) => {
    const parsed = reviewSegmentSchema.safeParse({ start: Number(start), end: Number(end), status });
    if (!parsed.success) { toast.error("Choose a valid start and end time."); return; }
    const duration = videoRef.current?.duration;
    if (duration && parsed.data.end > duration) { toast.error("The range ends after the video."); return; }
    onChange([...segments, parsed.data].sort((a, b) => a.start - b.start));
  };
  const step = (direction: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + direction / 30));
  };
  const seconds = reviewedWindows(segments, shifts).reduce((sum, w) => sum + w.end - w.start, 0);
  return <section className="space-y-4 border-t border-border pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Review player visibility</h2>
      <span className="text-sm text-muted-foreground">{fmt(seconds)} verified on ice</span>
    </div>
    <div className="flex gap-2">
      <Button size="icon" variant="outline" aria-label="Step backward" title="Step backward" onClick={() => step(-1)}><SkipBack className="size-4" /></Button>
      <Button size="icon" variant="outline" aria-label="Step forward" title="Step forward" onClick={() => step(1)}><SkipForward className="size-4" /></Button>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2"><Label htmlFor="review-start">Start (seconds)</Label><Input id="review-start" type="number" min="0" step="0.033" value={start} onChange={e => setStart(e.target.value)} /><Button size="sm" variant="ghost" onClick={() => setStart(String(videoRef.current?.currentTime ?? 0))}>Use current time</Button></div>
      <div className="space-y-2"><Label htmlFor="review-end">End (seconds)</Label><Input id="review-end" type="number" min="0" step="0.033" value={end} onChange={e => setEnd(e.target.value)} /><Button size="sm" variant="ghost" onClick={() => setEnd(String(videoRef.current?.currentTime ?? 0))}>Use current time</Button></div>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => add("verified")}><CheckCircle2 className="size-4" />Verified player</Button>
      <Button size="sm" variant="outline" onClick={() => add("uncertain")}><AlertTriangle className="size-4" />Uncertain identity</Button>
      <Button size="sm" variant="outline" onClick={() => add("offscreen")}><EyeOff className="size-4" />Off-screen</Button>
      <Button size="sm" variant="outline" onClick={() => add("wrong_player")}><UserX className="size-4" />Wrong player</Button>
    </div>
    <ul className="divide-y divide-border">{segments.map((s, i) => <li key={`${s.start}-${s.end}-${i}`} className="flex items-center justify-between gap-2 py-2">
      <Button variant="ghost" size="sm" className="h-auto whitespace-normal text-left" onClick={() => { const v = videoRef.current; if (v) { v.pause(); v.currentTime = s.start; } }}>{fmt(s.start)}–{fmt(s.end)} · {labels[s.status]}</Button>
      <Button variant="ghost" size="icon" aria-label={`Remove review range ${i + 1}`} title="Remove range" onClick={() => onChange(segments.filter((_, j) => i !== j))}><Trash2 className="size-4" /></Button>
    </li>)}</ul>
    <Button variant="outline" disabled={saving} onClick={onSave}>{saving ? "Saving…" : "Save review"}</Button>
  </section>;
}