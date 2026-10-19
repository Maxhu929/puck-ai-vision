import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Scan, Undo2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type PlayerMark } from "@/lib/analysis.functions";
import { boxCheckpoints, nextCrossedCheckpoint, BOX_INTERVAL_SECONDS } from "@/lib/player-identification";
import { PlayerTrackingArrow } from "@/components/PlayerTrackingArrow";

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
  const [guided, setGuided] = useState(false);
  const [placingArrow, setPlacingArrow] = useState(false);
  const [trackingRequest, setTrackingRequest] = useState<{ box: PlayerMark; sequence: number } | null>(null);
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

  /** Playback stops itself at every checkpoint that still needs a box, so a moment is never scrolled past. */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || boxOn) return;
    const checkpoints = boxCheckpoints(shifts, marks);
    if (!checkpoints.some((c) => !c.covered)) return;
    let from = v.currentTime;
    const onSeeked = () => { from = v.currentTime; };
    const onTime = () => {
      const to = v.currentTime;
      const hit = nextCrossedCheckpoint(checkpoints, from, to);
      from = to;
      if (!hit || v.paused || v.seeking) return;
      v.pause();
      setGuided(true);
      beginBox(hit.time);
      toast.info(`Paused at ${fmt(hit.time)} — box yourself here`);
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeked", onSeeked);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeked", onSeeked);
    };
  }, [videoRef, shifts, marks, boxOn]);

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
    const v = videoRef.current;
    let referenceImage: string | undefined;
    if (v && !v.seeking && v.videoWidth > 0 && Math.abs(v.currentTime - m.time) < 0.1) {
      try {
        const canvas = document.createElement("canvas");
        const cropWidth = m.w * v.videoWidth, cropHeight = m.h * v.videoHeight;
        const scale = Math.min(1, 320 / Math.max(cropWidth, cropHeight));
        canvas.width = Math.max(1, Math.round(cropWidth * scale));
        canvas.height = Math.max(1, Math.round(cropHeight * scale));
        const context = canvas.getContext("2d");
        if (context) {
          context.drawImage(v, m.x * v.videoWidth, m.y * v.videoHeight, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
          referenceImage = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
        }
      } catch { toast.warning("Box saved, but a reference photo could not be captured from this footage."); }
    }
    // Re-drawing a shift anchor replaces its box, rather than duplicating it.
    const next = [...marks.filter((old) => Math.abs(old.time - m.time) >= 0.05), { ...m, ...(referenceImage ? { referenceImage } : {}) }].sort((a, b) => a.time - b.time);
    setMarks(next);
    setBoxOn(false);
    if (placingArrow) {
      setTrackingRequest(previous => ({ box: m, sequence: (previous?.sequence ?? 0) + 1 }));
      setPlacingArrow(false);
    }
    const upcoming = guided ? boxCheckpoints(shifts, next).find((c) => !c.covered) : undefined;
    if (upcoming) {
      toast.success(`Boxed at ${fmt(m.time)} — now box yourself at ${fmt(upcoming.time)}`);
      beginBox(upcoming.time);
    } else {
      if (guided) toast.success("Every checkpoint is boxed. Tap Save identification & re-grade.");
      else toast.success(`Player marked at ${fmt(m.time)}`);
      setGuided(false);
    }
  };
  const cancel = () => { setPlacingArrow(false); setGuided(false); setBoxOn(false); setDraft(null); origin.current = null; draftRef.current = null; };
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
      <PlayerTrackingArrow videoRef={videoRef} frame={frame} request={trackingRequest} onPlace={() => { setGuided(false); setPlacingArrow(true); beginBox(videoRef.current?.currentTime ?? 0); }} />
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
      {boxOn && <div className="pointer-events-none absolute left-3 bottom-14 rounded-md bg-background/85 px-3 py-1 text-xs font-medium">{placingArrow ? "Select player for arrow" : "Box player"} · {fmt(anchorTime.current)}</div>}
    </div>
    <div className="space-y-3 border-b border-border py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => boxOn ? cancel() : beginBox(videoRef.current?.currentTime ?? 0)} variant={boxOn ? "secondary" : "default"} size="sm" disabled={saving}>
          {boxOn ? <X className="size-4" /> : <Scan className="size-4" />}{boxOn ? "Cancel box" : "Box player"}
        </Button>
        <Button onClick={() => setMarks((m) => m.slice(0, -1))} variant="ghost" size="icon" title="Undo last box" aria-label="Undo last box" disabled={!marks.length || saving}><Undo2 className="size-4" /></Button>
        <Button onClick={save} variant="outline" size="sm" disabled={saving || boxOn}>{saving && <Loader2 className="size-4 animate-spin" />}{saving ? "Re-grading…" : "Save identification & re-grade"}</Button>
      </div>
      {shifts.length > 0 && (() => {
        const checkpoints = boxCheckpoints(shifts, marks);
        const missing = checkpoints.filter((c) => !c.covered);
        return <div className="space-y-2 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm"><span className="font-medium">{checkpoints.length - missing.length} of {checkpoints.length} boxes</span> <span className="text-muted-foreground">· box yourself every {BOX_INTERVAL_SECONDS} seconds while you're on the ice so the AI never has to follow you far.</span></p>
            <Button size="sm" disabled={saving || !missing.length} onClick={() => { setGuided(true); beginBox(missing[0].time); }}>
              <Scan className="size-4" />{missing.length ? `Box the ${missing.length} missing` : "All boxed"}
            </Button>
          </div>
          <ul className="space-y-1">{shifts.map((s, i) => {
            const own = checkpoints.filter((c) => c.shiftIndex === i);
            return <li key={s.start} className="flex flex-wrap items-center gap-1 text-sm">
              <span className="mr-1">Shift {i + 1}</span>
              {own.map((c) => <Button key={c.time} size="sm" variant={c.covered ? "secondary" : "outline"} disabled={saving} title={c.covered ? "Redraw this box" : "Box this moment"} onClick={() => beginBox(c.time)}>
                {fmt(c.time)}{c.covered ? " ✓" : ""}
              </Button>)}
            </li>;
          })}</ul>
        </div>;
      })()}
      {marks.length > 0 && <div className="flex flex-wrap gap-2">{marks.map((m, i) => <div key={`${m.time}-${i}`} className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => { if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = m.time; } }}>Box at {fmt(m.time)}</Button>
        <Button variant="ghost" size="icon" aria-label={`Remove box at ${fmt(m.time)}`} title="Remove box" disabled={saving} onClick={() => setMarks((all) => all.filter((_, j) => j !== i))}><X className="size-3" /></Button>
      </div>)}</div>}
    </div>
  </div>;
}
