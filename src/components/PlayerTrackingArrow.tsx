import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowDown, Loader2, Square, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TrackingBox, PlayerTracker } from "@/lib/player-tracker";

export function PlayerTrackingArrow({ videoRef, frame, request, onPlace }: {
  videoRef: RefObject<HTMLVideoElement | null>;
  frame: { left: number; top: number; width: number; height: number };
  request: { box: TrackingBox; sequence: number } | null;
  onPlace: () => void;
}) {
  const [box, setBox] = useState<TrackingBox | null>(null);
  const [state, setState] = useState("off");
  const [error, setError] = useState("");
  const tracker = useRef<PlayerTracker | null>(null);
  const stop = () => { tracker.current = null; setBox(null); setState("off"); };
  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    tracker.current = null;
    setBox(null); setState("loading"); setError("");
    void import("@/lib/player-tracker").then(({ PlayerTracker }) => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video || video.seeking || video.readyState < 2) throw new Error("Wait for the video frame to load, then select the player again.");
      tracker.current = new PlayerTracker(video, request.box);
      setBox(request.box); setState("tracking");
    }).catch(error => { if (!cancelled) { setState("lost"); setError(error instanceof Error ? error.message : "Tracking could not start."); } });
    return () => { cancelled = true; tracker.current = null; };
  }, [request, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let callback = 0, last = video.currentTime;
    const lost = (reason: string) => { if (!tracker.current) return; tracker.current = null; setBox(null); setState("lost"); setError(reason); };
    const tick = (_now: number, metadata: VideoFrameCallbackMetadata) => {
      if (tracker.current && !video.paused && metadata.mediaTime !== last) {
        if (Math.abs(metadata.mediaTime - last) > .25) lost("Tracking interrupted. Select the player again.");
        else {
          try {
            const next = tracker.current.update(video);
            if (next) setBox(next);
            else lost("Player lost. Select the player again.");
          } catch { lost("This footage couldn't be read for tracking."); }
        }
      }
      last = metadata.mediaTime;
      callback = video.requestVideoFrameCallback(tick);
    };
    const seek = () => lost("Video skipped. Select the player again.");
    const play = () => { last = video.currentTime; };
    const ended = () => lost("Playback ended.");
    if (!video.requestVideoFrameCallback) { setError("Arrow tracking isn't available in this browser."); return; }
    callback = video.requestVideoFrameCallback(tick);
    video.addEventListener("seeking", seek); video.addEventListener("play", play); video.addEventListener("ended", ended);
    return () => { video.cancelVideoFrameCallback(callback); video.removeEventListener("seeking", seek); video.removeEventListener("play", play); video.removeEventListener("ended", ended); };
  }, [videoRef]);

  return <>
    {box && <div aria-label="Following player arrow" className="pointer-events-none absolute" style={{ left: `${frame.left + (box.x + box.w / 2) * frame.width}%`, top: `${frame.top + box.y * frame.height}%` }}>
      <ArrowDown strokeWidth={3} className="size-8 -translate-x-1/2 -translate-y-full text-ice drop-shadow-md" />
    </div>}
    <div className="absolute top-2 left-2 right-2 flex flex-wrap items-center gap-2 bg-background/90 px-2 py-1 rounded-md">
      <Button size="sm" variant="outline" onClick={() => { stop(); onPlace(); }} disabled={state === "loading"}>
        {state === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />}Place tracking arrow
      </Button>
      {state === "tracking" && <><span className="text-xs text-turf" role="status">Tracking · experimental</span><Button size="icon" variant="ghost" title="Stop tracking" aria-label="Stop tracking" onClick={stop}><Square className="size-4" /></Button></>}
      {error && <span role="status" className="text-xs text-gold">{error}</span>}
    </div>
  </>;
}