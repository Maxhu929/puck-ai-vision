import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Scan, Undo2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type PlayerMark } from "@/lib/analysis.functions";

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** Normalized boxes are stored in video-frame coordinates, not the letterboxed player. */
export function PlayerPen({ analysisId, initial, videoRef, children, shifts, markRequest, onMarksChange, onSave }: {
  analysisId: string;
  initial: PlayerMark[];
  videoRef: RefObject<HTMLVideoElement | null>;
  children: ReactNode;
  shifts: Array<{ start: number; end: number }>;
  markRequest: { time: number; sequence: number } | null;
  onMarksChange: (marks: PlayerMark[]) => void;
  onSave: (marks?: PlayerMark[]) => Promise<void>;
}) {
  const [marks, setMarks] = useState<PlayerMark[]>(initial);
  const [boxOn, setBoxOn] = useState(false);
  const [draft, setDraft] = useState<PlayerMark | null>(null);
  const [time, setTime] = useState(0);
  const [saving, setSaving] = useState(false);
  const [frame, setFrame] = useState({ left: 0, top: 0, width: 100, height: 100 });
  const boxRef = useRef<HTMLDivElement>(null);
  const origin = useRef<[number, number] | null>(null);
  const draftRef = useRef<PlayerMark | null>(null);
  const anchorTime = useRef(0);
  useEffect(() => onMarksChange(marks), [marks, onMarksChange]);

  useEffect(() => setMarks(initial), [initial]);
  useEffect(() => {
    const v = videoRef.current;
    const container = boxRef.current;
    if (!v || !container) return;
    const onTime = () => setTime(v.currentTime);
    const measure = () => {
      if (!v.videoWidth || !v.videoHeight) return;
      const scale = Math.min(container.clientWidth / v.videoWidth, container.clientHeight / v.videoHeight);
      const width = v.videoWidth * scale / container.clientWidth * 100;
      const height = v.videoHeight * scale / container.clientHeight * 100;
      setFrame({ left: (100 - width) / 2, top: (100 - height) / 2, width, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    measure();
    v.addEventListener("loadedmetadata", measure);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeked", onTime);
    return () => {
      observer.disconnect();
      v.removeEventListener("loadedmetadata", measure);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeked", onTime);
    };
  }, [videoRef]);

  const beginBox = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = t;
    anchorTime.current = t;
    setTime(t);
    setDraft(null);
    draftRef.current = null;
    origin.current = null;
    setBoxOn(true);
    v.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    if (markRequest) beginBox(markRequest.time);
  }, [markRequest]);

  const point = (e: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const finish = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!origin.current) return;
    const [x2, y2] = point(e);
    const [x1, y1] = origin.current;
    const m = { time: anchorTime.current, x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
    origin.current = null;
    draftRef.current = null;
    setDraft(null);
    if (m.w < 0.01 || m.h < 0.01) return;
    // Re-drawing a shift anchor replaces its box, rather than duplicating it.
    setMarks((all) => [...all.filter((old) => Math.abs(old.time - m.time) >= 0.05), m].sort((a, b) => a.time - b.time));
    setBoxOn(false);
    toast.success(`Player marked at ${fmt(m.time)}`);
  };
  const cancel = () => { setBoxOn(false); setDraft(null); origin.current = null; draftRef.current = null; };
  const save = async () => {
    setSaving(true);
    try {
      await onSave(marks);
    } catch { toast.error("Couldn't re-grade right now. Try again in a minute."); }
    finally { setSaving(false); }
  };
  const visible = marks.filter((m) => Math.abs(m.time - time) < 1.5);
  const rectangle = (m: PlayerMark, key: string) => <rect key={key} x={m.x * 100} y={m.y * 100} width={m.w * 100} height={m.h * 100} fill="none" stroke="var(--color-ice)" strokeWidth={3} vectorEffect="non-scaling-stroke" />;

  return <div className="space-y-3">
    <div ref={boxRef} className="relative">
      {children}
      <svg aria-label="Player bounding box overlay" viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ left: `${frame.left}%`, top: `${frame.top}%`, width: `${frame.width}%`, height: `${frame.height}%` }}
        className={`absolute ${boxOn ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
        onPointerDown={(e) => { if (!boxOn) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); origin.current = point(e); }}
        onPointerMove={(e) => {
          if (!origin.current) return;
          const [x1, y1] = origin.current, [x2, y2] = point(e);
          const next = { time: anchorTime.current, x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
          draftRef.current = next;
          setDraft(next);
        }}
        onPointerUp={finish}
        onPointerCancel={cancel}>
        {visible.map((m, i) => rectangle(m, String(i)))}
        {draft ? rectangle(draft, "draft") : null}
      </svg>
      {boxOn && <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/85 px-3 py-1 text-xs font-medium">Box player · {fmt(anchorTime.current)}</div>}
    </div>
    <div className="space-y-3 border-b border-border py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => boxOn ? cancel() : beginBox(videoRef.current?.currentTime ?? 0)} variant={boxOn ? "secondary" : "default"} size="sm" disabled={saving}>
          {boxOn ? <X className="size-4" /> : <Scan className="size-4" />}{boxOn ? "Cancel box" : "Box player"}
        </Button>
        <Button onClick={() => setMarks((m) => m.slice(0, -1))} variant="ghost" size="icon" title="Undo last box" aria-label="Undo last box" disabled={!marks.length || saving}><Undo2 className="size-4" /></Button>
        <Button onClick={save} variant="outline" size="sm" disabled={saving || boxOn}>{saving && <Loader2 className="size-4 animate-spin" />}{saving ? "Re-grading…" : "Save identification & re-grade"}</Button>
      </div>
      {shifts.length > 0 && <ul className="space-y-2">{shifts.map((s, i) => {
        const marked = marks.some((m) => Math.abs(m.time - s.start) < 0.05);
        return <li key={s.start} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>Shift {i + 1} · {fmt(s.start)} <span className="text-muted-foreground">· {marked ? "Box added" : "Not marked"}</span></span>
          <Button variant="outline" size="sm" disabled={saving} onClick={() => beginBox(s.start)}><Scan className="size-4" />{marked ? "Redraw" : "Mark shift start"}</Button>
        </li>;
      })}</ul>}
      {marks.length > 0 && <div className="flex flex-wrap gap-2">{marks.map((m, i) => <div key={`${m.time}-${i}`} className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => { if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = m.time; } }}>Box at {fmt(m.time)}</Button>
        <Button variant="ghost" size="icon" aria-label={`Remove box at ${fmt(m.time)}`} title="Remove box" disabled={saving} onClick={() => setMarks((all) => all.filter((_, j) => j !== i))}><X className="size-3" /></Button>
      </div>)}</div>}
    </div>
  </div>;
}
