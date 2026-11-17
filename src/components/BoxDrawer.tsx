import { useEffect, useRef, useState, type RefObject } from "react";
import { containedFrame, type TrialBox } from "@/lib/sam-trial";


/** Measure the letterboxed video frame inside its container so overlays align. */
/** `displayRef` is the element the picture is shown in (defaults to the video; a mirror canvas otherwise). */
export function useVideoFrame(videoRef: RefObject<HTMLVideoElement | null>, containerRef: RefObject<HTMLDivElement | null>, displayRef?: RefObject<HTMLElement | null>) {
  const [frame, setFrame] = useState({ left: 0, top: 0, width: 100, height: 100 });
  useEffect(() => {
    const v = videoRef.current;
    const container = containerRef.current;
    if (!v || !container) return;
    const measure = () => {
      if (!v.videoWidth || !v.videoHeight) return;
      // Measure the <video> element itself (the overlay is positioned against the same container).
      const vr = (displayRef?.current ?? v).getBoundingClientRect(), cr = container.getBoundingClientRect();
      if (!cr.width || !cr.height) return;
      const inner = containedFrame(vr.width, vr.height, v.videoWidth, v.videoHeight);
      setFrame({
        left: ((vr.left - cr.left) + (inner.left / 100) * vr.width) / cr.width * 100,
        top: ((vr.top - cr.top) + (inner.top / 100) * vr.height) / cr.height * 100,
        width: (inner.width / 100) * vr.width / cr.width * 100,
        height: (inner.height / 100) * vr.height / cr.height * 100,
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(v);
    if (displayRef?.current) observer.observe(displayRef.current);
    measure();
    v.addEventListener("loadedmetadata", measure);
    v.addEventListener("resize", measure);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); v.removeEventListener("loadedmetadata", measure); v.removeEventListener("resize", measure); window.removeEventListener("resize", measure); };
  }, [videoRef, containerRef, displayRef]);
  return frame;
}

/** Minimal box-drawing overlay (same interaction as the feedback page's box tool). */
export function BoxDrawer({ videoRef, containerRef, active, box, onBox }: {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  active: boolean;
  box: TrialBox | null;
  onBox: (b: TrialBox | null) => void;
}) {
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
