import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { PenLine, Undo2, Loader2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { savePlayerMarks, type PlayerMark } from "@/lib/analysis.functions";

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** Wraps the video with a pen overlay so the user can circle themselves on screen. */
export function PlayerPen({
  analysisId,
  initial,
  videoRef,
  children,
}: {
  analysisId: string;
  initial: PlayerMark[];
  videoRef: RefObject<HTMLVideoElement | null>;
  children: ReactNode;
}) {
  const [marks, setMarks] = useState<PlayerMark[]>(initial);
  const [penOn, setPenOn] = useState(false);
  const [path, setPath] = useState<Array<[number, number]>>([]);
  const [time, setTime] = useState(0);
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const qc = useQueryClient();

  useEffect(() => setMarks(initial), [initial]);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const on = () => setTime(v.currentTime);
    v.addEventListener("timeupdate", on);
    v.addEventListener("seeked", on);
    return () => {
      v.removeEventListener("timeupdate", on);
      v.removeEventListener("seeked", on);
    };
  }, [videoRef]);

  const point = (e: React.PointerEvent): [number, number] => {
    const r = boxRef.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };

  const togglePen = () => {
    if (!penOn) videoRef.current?.pause();
    setPenOn((p) => !p);
  };

  const finish = () => {
    drawing.current = false;
    if (path.length < 3) return setPath([]);
    const xs = path.map((p) => p[0]);
    const ys = path.map((p) => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    setPath([]);
    if (w < 0.01 || h < 0.01) return;
    const t = videoRef.current?.currentTime ?? 0;
    setMarks((m) => [...m, { time: t, x, y, w, h }].sort((a, b) => a.time - b.time));
    setPenOn(false);
    toast.success(`Circled at ${fmt(t)}`);
  };

  const jump = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await savePlayerMarks({ data: { id: analysisId, marks } });
      if (res.error) toast.error(res.error);
      else toast.success("Re-graded using your circles");
      await qc.invalidateQueries({ queryKey: ["analysis", analysisId] });
    } catch {
      toast.error("Couldn't re-grade right now. Try again in a minute.");
    } finally {
      setSaving(false);
    }
  };

  const visible = marks.filter((m) => Math.abs(m.time - time) < 1.5);

  return (
    <div className="space-y-3">
      <div ref={boxRef} className="relative">
        {children}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className={`absolute inset-0 size-full rounded-2xl ${penOn ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
          onPointerDown={(e) => {
            if (!penOn) return;
            (e.target as Element).setPointerCapture(e.pointerId);
            drawing.current = true;
            setPath([point(e)]);
          }}
          onPointerMove={(e) => drawing.current && setPath((p) => [...p, point(e)])}
          onPointerUp={finish}
        >
          {visible.map((m, i) => (
            <ellipse
              key={i}
              cx={(m.x + m.w / 2) * 100}
              cy={(m.y + m.h / 2) * 100}
              rx={(m.w / 2) * 100}
              ry={(m.h / 2) * 100}
              fill="none"
              stroke="var(--color-ice, currentColor)"
              strokeWidth={0.6}
              vectorEffect="non-scaling-stroke"
              style={{ strokeWidth: 3 }}
            />
          ))}
          {path.length > 1 && (
            <polyline
              points={path.map(([x, y]) => `${x * 100},${y * 100}`).join(" ")}
              fill="none"
              stroke="var(--color-ice, currentColor)"
              vectorEffect="non-scaling-stroke"
              style={{ strokeWidth: 3 }}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
        {penOn && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-background/85 px-3 py-1 text-xs font-medium">
            Draw a circle around yourself
          </div>
        )}
      </div>

      <div className="surface-card space-y-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={togglePen} variant={penOn ? "secondary" : "default"} size="sm">
            {penOn ? <X className="size-4" /> : <PenLine className="size-4" />}
            {penOn ? "Cancel pen" : "Circle me"}
          </Button>
          <Button onClick={() => setMarks((m) => m.slice(0, -1))} variant="ghost" size="sm" disabled={!marks.length}>
            <Undo2 className="size-4" /> Undo
          </Button>
          <Button onClick={save} variant="outline" size="sm" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save circles & re-grade
          </Button>
          <span className="text-sm text-muted-foreground">
            Pause where you're visible, tap Circle me, and draw around yourself. A few circles across the clip work best.
          </span>
        </div>
        {marks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {marks.map((m, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-muted/50 px-3 py-1 text-xs">
                <button type="button" className="text-ice hover:underline" onClick={() => jump(m.time)}>
                  Circle at {fmt(m.time)}
                </button>
                <button
                  type="button"
                  aria-label="Remove circle"
                  onClick={() => setMarks((all) => all.filter((_, j) => j !== i))}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
