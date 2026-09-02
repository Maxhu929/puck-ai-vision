import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { UploadCloud, Film, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { PageShell } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createVideoUploadUrl, listAnalyses, refreshAnalysis } from "@/lib/analysis.functions";

const title = "Upload Game Footage | Hockey Video Analyzer";
const description =
  "Drop in a shift, a period, or a full hockey game and let the AI break down every play with grades and timestamped notes.";

export const Route = createFileRoute("/upload")({
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
  component: UploadPage,
});

function UploadPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "indexing" | "ready" | "failed">("idle");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const meta = useRef({ gameLabel: "", jerseyNumber: "", focusAreas: "" });

  const refresh = useServerFn(refreshAnalysis);
  const createUploadUrl = useServerFn(createVideoUploadUrl);
  const recent = useQuery({ queryKey: ["analyses"], queryFn: () => listAnalyses() });

  useEffect(() => {
    if (phase !== "indexing" || !analysisId) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      const res = await refresh({ data: { id: analysisId } });
      if (cancelled || !res.record) return;
      if (res.record.status === "ready") {
        setPhase("ready");
        setProgress(100);
        setMessage(`Analysis complete — ${res.record.notes.length} plays detected.`);
        recent.refetch();
      } else if (res.record.status === "failed") {
        setPhase("failed");
        setMessage(res.record.errorMessage ?? "Analysis failed.");
      } else {
        setProgress((p) => Math.min(95, p + 3));
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, analysisId]);

  async function startUpload(file: File) {
    const MAX_BYTES = 2 * 1024 * 1024 * 1024; // storage bucket limit

    setFileName(file.name);
    setProgress(2);
    setMessage(null);
    setAnalysisId(null);

    if (file.size > MAX_BYTES) {
      setPhase("failed");
      setProgress(0);
      setMessage(
        `This clip is ${(file.size / 1024 / 1024 / 1024).toFixed(1)} GB. Uploads are capped at 2 GB — trim the footage and try again.`,
      );
      return;
    }

    setPhase("uploading");

    let upload: { path: string; token: string; uploadUrl: string };
    try {
      upload = await createUploadUrl({
        data: { fileName: file.name, contentType: file.type || "video/mp4" },
      });
    } catch (err) {
      setPhase("failed");
      setMessage(err instanceof Error ? err.message : "Could not start the upload.");
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", upload.uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.timeout = 60 * 60 * 1000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 55));
    };
    xhr.onload = async () => {
      try {
        if (xhr.status >= 400) {
          throw new Error(`Upload failed (storage responded ${xhr.status}). Try again.`);
        }
        setProgress(58);
        setMessage("Sending footage to the AI…");
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: upload.path,
            fileName: file.name,
            contentType: file.type || "video/mp4",
            playerName: meta.current.playerName,
            jerseyNumber: meta.current.jerseyNumber,
            focusAreas: meta.current.focusAreas,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Analysis could not be started");
        setAnalysisId(json.id!);
        setPhase("indexing");
        setProgress(60);
        setMessage("Indexing footage with Twelve Labs…");
      } catch (err) {
        setPhase("failed");
        setMessage(err instanceof Error ? err.message : "Upload failed");
      }
    };
    xhr.ontimeout = () => {
      setPhase("failed");
      setMessage("Upload timed out. Very large videos can take a while — try again on a faster connection.");
    };
    xhr.onerror = () => {
      setPhase("failed");
      setMessage(
        "The upload connection was closed before the video finished sending. Check your connection and try again.",
      );
    };
    xhr.send(file);
  }


  return (
    <PageShell title="Upload" subtitle="Add game footage and the AI will grade every shift.">
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <label
            htmlFor="video"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) startUpload(f);
            }}
            className="surface-card flex cursor-pointer flex-col items-center justify-center rounded-2xl border-dashed px-6 py-20 text-center transition-colors hover:border-ice"
          >
            <UploadCloud className="size-10 text-ice" strokeWidth={1.75} />
            <span className="mt-5 text-lg font-semibold">Drop your video here</span>
            <span className="mt-1 text-sm text-muted-foreground">MP4, MOV or HEVC — up to 2 GB per clip</span>
            <input
              id="video"
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) startUpload(f);
              }}
            />
          </label>

          {fileName ? (
            <div className="surface-card rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <Film className="size-5 text-turf" />
                <span className="truncate font-medium">{fileName}</span>
                <span className="ml-auto text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="mt-4" />
              {phase === "ready" && analysisId ? (
                <div className="mt-5 flex items-center gap-3">
                  <Sparkles className="size-4 text-gold" />
                  <p className="text-sm text-muted-foreground">{message}</p>
                  <Button asChild size="sm" className="ml-auto">
                    <Link to="/feedback" search={{ id: analysisId }}>
                      See AI feedback
                    </Link>
                  </Button>
                </div>
              ) : phase === "failed" ? (
                <div className="mt-5 flex items-center gap-3">
                  <AlertTriangle className="size-4 text-gold" />
                  <p className="text-sm text-muted-foreground">{message}</p>
                </div>
              ) : (
                <div className="mt-5 flex items-center gap-3">
                  <Loader2 className="size-4 animate-spin text-ice" />
                  <p className="text-sm text-muted-foreground">
                    {message ?? "Uploading footage…"}
                  </p>
                </div>
              )}
            </div>
          ) : null}

          <div className="surface-card grid gap-5 rounded-2xl p-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="game">Game or session</Label>
              <Input
                id="game"
                placeholder="Bantam AA vs. Northside"
                onChange={(e) => (meta.current.playerName = e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jersey">Your jersey number</Label>
              <Input
                id="jersey"
                placeholder="17"
                onChange={(e) => (meta.current.jerseyNumber = e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="focus">What should the AI focus on?</Label>
              <Input
                id="focus"
                placeholder="Zone entries, defensive positioning, shot selection…"
                onChange={(e) => (meta.current.focusAreas = e.target.value)}
              />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <h2 className="text-lg font-semibold">Recent submissions</h2>
          {recent.data?.items.length ? (
            <ul className="space-y-3">
              {recent.data.items.map((s) => (
                <li key={s.id} className="surface-card rounded-xl px-5 py-4">
                  <p className="truncate font-medium">{s.fileName ?? s.playerName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString()} · {s.status}
                  </p>
                  {s.overallGrade ? (
                    <Link
                      to="/feedback"
                      search={{ id: s.id }}
                      className="mt-2 block font-display text-lg font-bold text-turf"
                    >
                      {s.overallGrade}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="surface-card rounded-xl px-5 py-4 text-sm text-muted-foreground">
              No footage analyzed yet. Upload a clip to get your first AI breakdown.
            </p>
          )}
        </aside>
      </div>
    </PageShell>
  );
}