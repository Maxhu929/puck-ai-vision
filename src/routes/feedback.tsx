import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, AlertTriangle, PlayCircle, Target, ClipboardList, FlaskConical } from "lucide-react";
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
import { identityDetailsSchema } from "@/lib/player-identification";
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
  }, [id, record]);
  const saveAll = async (marks?: PlayerMark[], shifts?: Array<{ start: number; end: number }>) => {
    if (!record || savingIdentity) return;
    setSavingIdentity(true);
    try {
      const shiftWindows = shifts ?? draftShifts;
      const result = await saveIdentification({ data: { id: record.id, details, segments, marks: marks ?? draftMarks ?? record.marks, ...(shiftWindows !== null ? { shifts: shiftWindows } : {}) } });
      if (result.error) toast.error(result.error);
      else toast.success("Edits saved. Review and approve a copy before coaching analysis.");
      await qc.invalidateQueries({ queryKey: ["analysis", record.id] });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save identification"); }
    finally { setSavingIdentity(false); }
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const loggerRef = useRef<HTMLDivElement>(null);
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
          {record && videoUrl ? (
            <button
              type="button"
              onClick={() => loggerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="surface-card flex w-full items-center gap-3 rounded-xl px-5 py-3 text-left transition-colors hover:border-ice/40"
            >
              <ClipboardList className="size-5 shrink-0 text-ice" />
              <span>
                <span className="block text-sm font-medium">Log your shifts</span>
              <span className="block text-xs text-muted-foreground">
                  Tap on and off the ice as you watch — the AI then grades only your shifts.
                </span>
              </span>
            </button>
          ) : null}
          {record && videoUrl ? (
            <Link
              to="/sam-trial"
              search={{ clip: record.id }}
              className="surface-card mb-0 flex w-full items-center gap-3 rounded-xl px-5 py-3 text-left transition-colors hover:border-ice/40"
            >
              <FlaskConical className="size-5 shrink-0 text-gold" />
              <span>
                <span className="block text-sm font-medium">Tracking trial (experimental)</span>
                <span className="block text-xs text-muted-foreground">
                  Test a new follow-the-player tracker on a short stretch of this clip — doesn't change grading.
                </span>
              </span>
            </Link>
          ) : null}
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
                    Add a box at each shift start and update the identifying clues below before re-grading.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {videoUrl ? (
            record ? (
              <PlayerPen key={record.id} analysisId={record.id} initial={record.marks} videoRef={videoRef} shifts={draftShifts ?? record.shifts} segments={segments} markRequest={markRequest} onMarksChange={setDraftMarks} onSave={saveAll}>
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

          {record && videoUrl ? (
            <div ref={loggerRef}>
              <ShiftLogger key={record.id} analysisId={record.id} initial={record.shifts} videoRef={videoRef} onShiftsChange={setDraftShifts} onSave={(shifts) => saveAll(undefined, shifts)} onMarkShift={(time) => setMarkRequest((previous) => ({ time, sequence: (previous?.sequence ?? 0) + 1 }))} />
            </div>
          ) : null}

          {record && videoUrl ? (
            <VideoReview segments={segments} onChange={setSegments} shifts={draftShifts ?? record.shifts} videoRef={videoRef} onSave={() => void saveAll()} saving={savingIdentity} />
          ) : null}
          {record && videoUrl ? (
            <HighlightEditor key={`hl-${record.id}`} analysisId={record.id} videoUrl={videoUrl} marks={draftMarks ?? record.marks} shifts={draftShifts ?? record.shifts} segments={segments} details={details} onSent={() => void qc.invalidateQueries({ queryKey: ["analysis", record.id] })} />
          ) : null}

          {record && <section className="space-y-4 border-t border-border pt-5">
            <h2 className="text-xl font-semibold">Player identification clues</h2>
            <PlayerIdentityFields value={details} onChange={setDetails} />
            <Button onClick={() => saveAll()} disabled={savingIdentity}>{savingIdentity ? "Saving…" : "Save identification"}</Button>
          </section>}
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