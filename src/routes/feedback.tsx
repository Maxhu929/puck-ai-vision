import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, AlertTriangle, PlayCircle, Target, FlaskConical, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { PageShell } from "@/components/AppNav";
import { Progress } from "@/components/ui/progress";
import { feedbackCategories, timelineFeedback } from "@/lib/hockey-data";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getAnalysis, getVideoPlaybackUrl, listAnalyses, savePlayerIdentification, type PlayerMark } from "@/lib/analysis.functions";
import { suggestDrills } from "@/lib/drills";
import { ShiftLogger } from "@/components/ShiftLogger";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlayerIdentityFields } from "@/components/PlayerIdentityFields";
import { boxCheckpoints, identityDetailsSchema } from "@/lib/player-identification";
import { PlayerPen } from "@/components/PlayerPen";
import { HighlightEditor } from "@/components/HighlightEditor";
import { VideoReview } from "@/components/VideoReview";
import type { ReviewSegment } from "@/lib/video-review";

const title = "AI Feedback & Shift Grades | Hockey Video Analyzer";
const description =
  "Timestamped AI feedback on every hockey play with explanations, category ratings, and an overall shift grade.";

export const Route = createFileRoute("/feedback")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeedbackPage,
});

const STEPS = [
  { title: "Log shifts", hint: "Tap on and off the ice as you watch" },
  { title: "Box yourself", hint: "The video pauses when a box is needed" },
  { title: "Mark clear moments", hint: "Tell us where you're clearly visible" },
  { title: "Send to AI", hint: "Approve the highlighted copy" },
];

function FeedbackPage() {
  const { id } = Route.useSearch();
  const { data } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => getAnalysis({ data: { id: id as string } }),
    enabled: Boolean(id),
    refetchInterval: query => ["pending", "indexing", "analyzing"].includes(query.state.data?.record?.status ?? "") ? 5000 : false,
  });

  const record = data?.record ?? null;
  const [details, setDetails] = useState(() => identityDetailsSchema.parse({}));
  const [draftMarks, setDraftMarks] = useState<PlayerMark[] | null>(null);
  const [segments, setSegments] = useState<ReviewSegment[]>([]);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [step, setStep] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const saveIdentification = useServerFn(savePlayerIdentification);
  const qc = useQueryClient();
  const initializedClip = useRef<string | null>(null);
  useEffect(() => {
    if (!id) initializedClip.current = null;
    if (!record || record.id !== id || initializedClip.current === record.id) return;
    initializedClip.current = record.id;
    setDetails(record.identityDetails);
    setDraftMarks(null);
    setDraftShifts(null);
    setSegments(record.reviewSegments);
    const shifts = record.shifts;
    const checkpoints = boxCheckpoints(shifts, record.marks);
    const done = [
      shifts.length > 0,
      checkpoints.length > 0 && checkpoints.every(c => c.covered),
      record.reviewSegments.some(s => s.status === "verified"),
    ];
    setStep(done.findIndex(d => !d) === -1 ? 3 : done.findIndex(d => !d));
  }, [id, record]);
  const saveAll = async (marks?: PlayerMark[], shifts?: Array<{ start: number; end: number }>) => {
    if (!record || savingIdentity) return;
    setSavingIdentity(true);
    try {
      const shiftWindows = shifts ?? draftShifts;
      const result = await saveIdentification({ data: { id: record.id, details, segments, marks: marks ?? draftMarks ?? record.marks, ...(shiftWindows !== null ? { shifts: shiftWindows } : {}) } });
      if (result.error) toast.error(result.error);
      else toast.success("Saved.");
      await qc.invalidateQueries({ queryKey: ["analysis", record.id] });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save identification"); }
    finally { setSavingIdentity(false); }
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const [draftShifts, setDraftShifts] = useState<Array<{ start: number; end: number }> | null>(null);
  const [markRequest, setMarkRequest] = useState<{ time: number; sequence: number } | null>(null);
  const playback = useQuery({
    queryKey: ["playback", id],
    queryFn: () => getVideoPlaybackUrl({ data: { id: id as string } }),
    enabled: Boolean(id),
    staleTime: 60 * 60 * 1000,
  });
  const videoUrl = playback.data?.url ?? null;
  const seek = (time: string) => {
    const parts = time.split(":").map(Number);
    if (!videoRef.current || parts.some(Number.isNaN)) return;
    videoRef.current.currentTime = parts.reduce((acc, n) => acc * 60 + n, 0);
    void videoRef.current.play();
    videoRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const notes = record ? (record.notes.length ? record.notes : []) : timelineFeedback;
  const categories = record ? (record.playerIdentified === true ? record.categories : []) : feedbackCategories;
  const grade = record ? (record.playerIdentified === true ? record.overallGrade ?? "N/A" : "N/A") : "A-";
  const drills = record && !categories.length ? [] : suggestDrills(categories);
  const graded = record?.playerIdentified === true;
  const identityLine = record
    ? [
        record.playerName,
        record.jerseyNumber ? `#${record.jerseyNumber}` : null,
        record.jerseyColor ? `${record.jerseyColor} jersey` : null,
        record.teamName,
        record.position,
        record.handedness ? `shoots ${record.handedness}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Bantam AA vs. Northside — 2nd Period · 12:40";

  const shiftsNow = record ? draftShifts ?? record.shifts : [];
  const marksNow = record ? draftMarks ?? record.marks : [];
  const checkpoints = record ? boxCheckpoints(shiftsNow, marksNow) : [];
  const boxedCount = checkpoints.filter(c => c.covered).length;
  const stepDone = [
    shiftsNow.length > 0,
    checkpoints.length > 0 && boxedCount === checkpoints.length,
    segments.some(s => s.status === "verified"),
  ];

  const next = async () => {
    await saveAll();
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const wizard = record && videoUrl ? (
    <div className="surface-card rounded-2xl p-5">
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => {
          const complete = i < STEPS.length - 1 ? stepDone[i] : false;
          const active = i === step;
          return (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => setStep(i)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${active ? "border-ice bg-ice/10 font-medium" : complete ? "border-turf/50 text-turf" : "border-border text-muted-foreground hover:border-ice/40"}`}
              >
                <span className={`flex size-5 items-center justify-center rounded-full text-xs ${complete ? "bg-turf/20 text-turf" : active ? "bg-ice/20 text-ice" : "bg-muted text-muted-foreground"}`}>
                  {complete ? <Check className="size-3" /> : i + 1}
                </span>
                {s.title}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-muted-foreground">{STEPS[step].hint}</p>

      <div className="mt-4">
        {step === 0 && (
          <ShiftLogger key={record.id} analysisId={record.id} initial={record.shifts} videoRef={videoRef} onShiftsChange={setDraftShifts} onSave={(shifts) => saveAll(undefined, shifts)} onMarkShift={(time) => setMarkRequest((previous) => ({ time, sequence: (previous?.sequence ?? 0) + 1 }))} />
        )}
        {step === 1 && (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{boxedCount} of {checkpoints.length} boxes done.</span>{" "}
              Just play the video above — it pauses by itself each time a box is needed. Draw a box around yourself, and it continues.
            </p>
            {checkpoints.length === 0 && <p>Log a shift first so we know when you're on the ice.</p>}
          </div>
        )}
        {step === 2 && (
          <VideoReview segments={segments} onChange={setSegments} shifts={shiftsNow} videoRef={videoRef} onSave={() => void saveAll()} saving={savingIdentity} />
        )}
        {step === 3 && (
          <HighlightEditor key={`hl-${record.id}`} analysisId={record.id} videoUrl={videoUrl} marks={marksNow} shifts={shiftsNow} segments={segments} details={details} onSent={() => void qc.invalidateQueries({ queryKey: ["analysis", record.id] })} />
        )}
      </div>

      {step < STEPS.length - 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
            <ChevronLeft className="size-4" />Back
          </Button>
          <Button size="sm" onClick={() => void next()} disabled={savingIdentity}>
            {savingIdentity ? "Saving…" : "Save & continue"}<ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <PageShell title="AI Feedback" subtitle={identityLine}>
      {!record ? <ClipPicker /> : null}
      {record && <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-4 text-sm">
        <span className="font-medium">{record.status === "awaiting_review" ? "Awaiting your review" : ["pending", "indexing", "analyzing"].includes(record.status) ? "Processing approved footage…" : record.status === "failed" ? "Processing failed" : "Report complete"}</span>
        <span className="text-muted-foreground">{record.reviewApproved ? "Approved copy" : "Approval required for new analysis"}</span>
        {record.errorMessage && <span className="text-destructive">{record.errorMessage}</span>}
      </div>}
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {record?.playerIdentified === false ? (
            <div className="surface-card rounded-2xl px-5 py-4">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-gold" />
                <div>
                  <p className="text-sm font-medium">
                    We couldn't confidently find {record.playerName} in this clip
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{record.summary || "The footage may be from a different game, or the player may not be on the ice."}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Work through the steps below — box yourself at each pause — then send the reviewed copy.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {videoUrl ? (
            record ? (
              <PlayerPen key={record.id} analysisId={record.id} initial={record.marks} videoRef={videoRef} shifts={shiftsNow} segments={segments} markRequest={markRequest} onMarksChange={setDraftMarks} onSave={saveAll}>
                <video
                  ref={videoRef}
                  crossOrigin="anonymous"
                  src={videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="surface-card aspect-video w-full rounded-2xl bg-background"
                />
              </PlayerPen>
            ) : (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                className="surface-card aspect-video w-full rounded-2xl bg-background"
              />
            )
          ) : (
          <div className="surface-card flex aspect-video items-center justify-center rounded-2xl">
            <div className="text-center">
              <PlayCircle className="mx-auto size-14 text-ice" strokeWidth={1.5} />
              <p className="mt-3 text-sm text-muted-foreground">
                {playback.isLoading
                  ? "Loading footage…"
                  : record
                    ? "Footage for this clip isn't available."
                    : "Game footage playback"}
              </p>
            </div>
          </div>
          )}

          {graded && !editOpen ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Change your markings and re-grade
            </button>
          ) : wizard}

          {record && (
            <details className="surface-card rounded-2xl px-5 py-4">
              <summary className="cursor-pointer text-sm font-medium">Extra clues (optional)</summary>
              <p className="mt-1 text-sm text-muted-foreground">Only needed if the AI keeps mixing you up with a teammate.</p>
              <div className="mt-4">
                <PlayerIdentityFields value={details} onChange={setDetails} />
                <Button className="mt-4" onClick={() => saveAll()} disabled={savingIdentity}>{savingIdentity ? "Saving…" : "Save clues"}</Button>
              </div>
            </details>
          )}

          {record?.identificationEvidence && <section className="space-y-3 border-t border-border pt-5">
            <h2 className="text-xl font-semibold">Identity check · {record.identificationEvidence.confidence} confidence</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">{record.identificationEvidence.observedClues.map((clue, i) => <li key={i}>{clue}</li>)}</ul>
            {record.identificationEvidence.uncertainty && <p className="text-sm text-muted-foreground">{record.identificationEvidence.uncertainty}</p>}
          </section>}
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Play-by-play notes</h2>
            {notes.length === 0 ? (
              <p className="surface-card rounded-xl px-5 py-4 text-sm text-muted-foreground">
                No play-by-play notes for this clip yet.
              </p>
            ) : null}
            {notes.map((f, i) => (
              <article key={`${f.time}-${i}`} className="surface-card flex gap-4 rounded-xl px-5 py-4">
                {f.type === "positive" ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-turf" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-gold" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {videoUrl ? (
                      <button type="button" onClick={() => seek(f.time)} className="font-display text-ice underline-offset-2 hover:underline">
                        {f.time}
                      </button>
                    ) : (
                      <span className="font-display text-ice">{f.time}</span>
                    )}
                    <span className="mx-2 text-muted-foreground">·</span>
                    {f.tag}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
                  {"evidence" in f && f.evidence && <dl className="mt-3 space-y-2 text-sm">
                    <div><dt className="font-medium">Observed evidence</dt><dd className="text-muted-foreground">{f.evidence}</dd></div>
                    <div><dt className="font-medium">Interpretation</dt><dd className="text-muted-foreground">{f.interpretation}</dd></div>
                    <div><dt className="font-medium">Coaching suggestion</dt><dd className="text-muted-foreground">{f.suggestion}</dd></div>
                    <div className="text-muted-foreground">{f.confidence} confidence · {f.visibility}</div>
                  </dl>}
                </div>
              </article>
            ))}
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Suggested drills</h2>
            {drills.length === 0 && <p className="text-sm text-muted-foreground">Drills will appear once the player is identified and graded.</p>}
            <p className="text-sm text-muted-foreground">
              Targeted at the lowest-scoring categories from this session.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {drills.map((d) => (
                <article key={d.name} className="surface-card rounded-xl px-5 py-4">
                  <div className="flex items-start gap-3">
                    <Target className="mt-0.5 size-5 shrink-0 text-ice" />
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="text-ice">{d.focus}</span>
                        <span className="mx-2">·</span>
                        {d.reps}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{d.detail}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {record && (
            <Link
              to="/sam-trial"
              search={{ clip: record.id }}
              className="flex items-center gap-2 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              <FlaskConical className="size-4 text-gold" />
              Tracking trial (experimental) — test a follow-the-player tracker on this clip
            </Link>
          )}
        </div>

        <aside className="space-y-6">
          <div className="surface-card rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Overall grade</p>
            <p className="mt-2 font-display text-6xl font-bold text-gradient-ice">{grade}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {record ? record.summary || "No approved coaching report yet." : "86 / 100 · top 12% of your league"}
            </p>
          </div>

          <div className="surface-card space-y-5 rounded-2xl p-6">
            <h2 className="text-lg font-semibold">Category ratings</h2>
            {record && !categories.length && <p className="text-sm text-muted-foreground">No verified player ratings yet.</p>}
            {categories.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">{c.score}</span>
                </div>
                <Progress value={c.score} className="mt-2" />
                <p className="mt-2 text-sm text-muted-foreground">{c.note}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

function ClipPicker() {
  const { data, isLoading } = useQuery({ queryKey: ["analyses"], queryFn: () => listAnalyses() });
  const items = data?.items ?? [];

  return (
    <div className="surface-card mb-8 rounded-2xl p-5">
      <h2 className="text-lg font-semibold">Pick a clip to open</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Open a clip to watch the footage and log your shifts — the logger sits right under the video.
      </p>
      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading your clips…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No clips yet. Upload a video to get feedback and log your shifts.
        </p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {items.map((a) => (
            <li key={a.id}>
              <Link
                to="/feedback"
                search={{ id: a.id }}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3 transition-colors hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {a.playerName || "Untitled clip"}
                    {a.jerseyNumber ? <span className="text-muted-foreground"> · #{a.jerseyNumber}</span> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} ·{" "}
                    {a.status === "ready" ? "graded" : a.status}
                  </span>
                </span>
                {a.overallGrade ? <span className="font-display text-lg text-ice">{a.overallGrade}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
