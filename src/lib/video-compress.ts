/**
 * Browser-side video downscaling.
 *
 * Big game clips are mostly wasted pixels for analysis purposes: the AI only
 * needs to see the play, not a 4K bitrate. When a file is large we re-encode it
 * in the browser at 720p / low bitrate / 15fps and upload that instead, which
 * makes the upload (and the hand-off to the analyzer) dramatically faster while
 * keeping the full duration and real timestamps intact.
 */

export const COMPRESS_THRESHOLD_BYTES = 300 * 1024 * 1024; // 300 MB

const TARGET_HEIGHT = 720;
const TARGET_FPS = 15;
const TARGET_BITRATE = 1_400_000; // ~1.4 Mbps — plenty for gameplay reading

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export function shouldCompress(file: File): boolean {
  return file.size > COMPRESS_THRESHOLD_BYTES && pickMimeType() !== null;
}

/**
 * Returns a smaller file, or the original if re-encoding is not possible or
 * did not actually help.
 */
export async function compressVideo(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<File> {
  const mimeType = pickMimeType();
  if (!mimeType) return file;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read this video file."));
    });

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return file;

    const scale = Math.min(1, TARGET_HEIGHT / (video.videoHeight || TARGET_HEIGHT));
    const width = Math.max(2, Math.round((video.videoWidth * scale) / 2) * 2);
    const height = Math.max(2, Math.round((video.videoHeight * scale) / 2) * 2);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    const stream = canvas.captureStream(TARGET_FPS);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: TARGET_BITRATE });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    const finished = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start(1000);
    await video.play();

    let raf = 0;
    const draw = () => {
      ctx.drawImage(video, 0, 0, width, height);
      onProgress?.(Math.min(1, video.currentTime / duration));
      raf = requestAnimationFrame(draw);
    };
    draw();

    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });
    cancelAnimationFrame(raf);
    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    await finished;

    const ext = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
    const type = mimeType.split(";")[0]!;
    const blob = new Blob(chunks, { type });
    if (!blob.size || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}-optimized.${ext}`, { type });
  } catch {
    return file;
  } finally {
    video.pause();
    video.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}
