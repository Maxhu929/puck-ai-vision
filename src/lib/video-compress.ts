/**
 * Browser-side video downscaling.
 *
 * Primary path: WebCodecs (via mediabunny) — hardware-accelerated transcoding
 * that runs several times faster than real time. Fallback: MediaRecorder
 * replay, which runs at playback speed and is only used for huge files.
 */

/** Files above this get shrunk with the fast WebCodecs path. */
export const COMPRESS_THRESHOLD_BYTES = 300 * 1024 * 1024; // 300 MB
/** The slow real-time fallback is only worth it above this size. */
const SLOW_FALLBACK_THRESHOLD_BYTES = 900 * 1024 * 1024;

const TARGET_HEIGHT = 720;
const TARGET_FPS = 15;
const TARGET_BITRATE = 1_400_000;

function hasWebCodecs() {
  return typeof window !== "undefined" && "VideoEncoder" in window && "VideoDecoder" in window;
}

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["video/mp4;codecs=avc1.42E01E", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export function shouldCompress(file: File): boolean {
  if (file.size <= COMPRESS_THRESHOLD_BYTES) return false;
  if (hasWebCodecs()) return true;
  return file.size > SLOW_FALLBACK_THRESHOLD_BYTES && pickMimeType() !== null;
}

export async function compressVideo(file: File, onProgress?: (fraction: number) => void): Promise<File> {
  if (hasWebCodecs()) {
    try {
      const out = await compressWithWebCodecs(file, onProgress);
      if (out) return out;
    } catch (err) {
      console.warn("Fast compression failed, falling back", err);
    }
    if (file.size <= SLOW_FALLBACK_THRESHOLD_BYTES) return file;
  }
  return compressWithMediaRecorder(file, onProgress);
}

async function compressWithWebCodecs(file: File, onProgress?: (f: number) => void): Promise<File | null> {
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target: new mb.BufferTarget() });
  const conversion = await mb.Conversion.init({
    input,
    output,
    video: { height: TARGET_HEIGHT, frameRate: TARGET_FPS, bitrate: TARGET_BITRATE },
    audio: { discard: true },
    showWarnings: false,
  });
  if (!conversion.isValid) return null;
  conversion.onProgress = (p) => onProgress?.(p);
  await conversion.execute();
  const buffer = output.target.buffer;
  if (!buffer || buffer.byteLength >= file.size) return null;
  const base = file.name.replace(/\.[^.]+$/, "");
  return new File([buffer], `${base}-optimized.mp4`, { type: "video/mp4" });
}

async function compressWithMediaRecorder(file: File, onProgress?: (f: number) => void): Promise<File> {
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
