import { useEffect, useState, type RefObject } from "react";
import { LogIn, LogOut, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Shift = { start: number; end: number };
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export function ShiftLogger({
  initial,
  videoRef,
  onShiftsChange,
  onMarkShift,
  onSave,
}: {
  analysisId: string;
  initial: Shift[];
  videoRef: RefObject<HTMLVideoElement | null>;
  onShiftsChange: (shifts: Shift[]) => void;
  onMarkShift: (time: number) => void;
  onSave: () => Promise<void>;
}) {
  const [shifts, setShifts] = useState<Shift[]>(initial);
  const [openStart, setOpenStart] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);


  useEffect(() => setShifts(initial), [initial]);
  const updateShifts = (next: Shift[]) => { setShifts(next); onShiftsChange(next); };

  const now = () => videoRef.current?.currentTime ?? 0;
  const toggle = () => {
    const t = now();
    if (openStart === null) {
      setOpenStart(t);
      onMarkShift(t);
    } else {
      if (t <= openStart) { toast.error("Move to the end of your shift before tapping Off ice."); return; }
      updateShifts([...shifts, { start: openStart, end: t }].sort((a, b) => a.start - b.start));
      setOpenStart(null);
    }
  };
  const jump = (t: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = t;
    void videoRef.current.play();
  };
  const total = shifts.reduce((a, s) => a + (s.end - s.start), 0);

  const save = async () => {
    setSaving(true);
    try {
      onShiftsChange(shifts);
      await onSave();
    } catch {
      toast.error("Couldn't re-grade right now. Try again in a minute.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="surface-card space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="text-lg font-semibold">Shift logger</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Play the video and tap when you step on the ice and when you come off. The AI will then grade only those moments.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={toggle} variant={openStart === null ? "default" : "secondary"}>
          {openStart === null ? <LogIn className="size-4" /> : <LogOut className="size-4" />}
          {openStart === null ? "On ice" : `Off ice (on since ${fmt(openStart)})`}
        </Button>
        {openStart !== null && <Button variant="ghost" onClick={() => setOpenStart(null)}>Cancel shift</Button>}
        <span className="text-sm text-muted-foreground">
          {shifts.length} shift{shifts.length === 1 ? "" : "s"} · {fmt(total)} ice time
        </span>
      </div>
      {shifts.length > 0 && (
        <ul className="space-y-2">
          {shifts.map((s, i) => (
            <li key={`${s.start}-${i}`} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <button type="button" onClick={() => jump(s.start)} className="font-display text-ice hover:underline">
                Shift {i + 1}: {fmt(s.start)} – {fmt(s.end)}
              </button>
              <button
                type="button"
                aria-label={`Remove shift ${i + 1}`}
                onClick={() => updateShifts(shifts.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button onClick={save} disabled={saving || openStart !== null} className="w-full">
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        {saving ? "Re-grading… (about a minute)" : "Save identification & re-grade"}
      </Button>
    </div>
  );
}
