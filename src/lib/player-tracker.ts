import jsfeat from "jsfeat";

export type TrackingBox = { x: number; y: number; w: number; h: number };
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** Reject inconsistent flow rather than projecting an arrow through missing footage. */
export function consistentMotion(motions: Array<{ dx: number; dy: number }>) {
  if (motions.length < 4) return null;
  const dx = median(motions.map(p => p.dx)), dy = median(motions.map(p => p.dy));
  const inliers = motions.filter(p => Math.hypot(p.dx - dx, p.dy - dy) <= 2.5);
  if (inliers.length < 4 || inliers.length / motions.length < .65) return null;
  return { dx: median(inliers.map(p => p.dx)), dy: median(inliers.map(p => p.dy)), inliers };
}

/** Lucas–Kanade optical flow follows visible texture, not a player's semantic identity. */
export class PlayerTracker {
  private previous: any;
  private current: any;
  private points = new Float32Array(160);
  private count = 0;
  private box: TrackingBox;
  private canvas = document.createElement("canvas");
  private context: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  constructor(video: HTMLVideoElement, box: TrackingBox) {
    this.width = Math.min(960, video.videoWidth);
    this.height = Math.round(this.width * video.videoHeight / video.videoWidth);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const context = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Video tracking isn't available in this browser.");
    this.context = context;
    this.box = { ...box };
    this.previous = new jsfeat.pyramid_t(3);
    this.current = new jsfeat.pyramid_t(3);
    this.previous.allocate(this.width, this.height, jsfeat.U8_t | jsfeat.C1_t);
    this.current.allocate(this.width, this.height, jsfeat.U8_t | jsfeat.C1_t);
    this.read(video, this.previous);
    this.seed();
    if (this.count < 6) throw new Error("Not enough player detail. Draw a tighter box on a clearer frame.");
  }
  private read(video: HTMLVideoElement, pyramid: any) {
    this.context.drawImage(video, 0, 0, this.width, this.height);
    const image = this.context.getImageData(0, 0, this.width, this.height);
    jsfeat.imgproc.grayscale(image.data, this.width, this.height, pyramid.data[0]);
    pyramid.build(pyramid.data[0], true);
  }
  private seed() {
    const corners = Array.from({ length: this.width * this.height }, () => new jsfeat.keypoint_t(0, 0, 0, 0));
    jsfeat.fast_corners.set_threshold(15);
    const n = jsfeat.fast_corners.detect(this.previous.data[0], corners, 4);
    const b = this.box;
    const inside = corners.slice(0, n).filter((p: any) => p.x > (b.x + b.w * .15) * this.width && p.x < (b.x + b.w * .85) * this.width && p.y > (b.y + b.h * .1) * this.height && p.y < (b.y + b.h * .85) * this.height).sort((a: any, c: any) => c.score - a.score).slice(0, 80);
    this.count = inside.length;
    inside.forEach((p: any, i: number) => { this.points[i * 2] = p.x; this.points[i * 2 + 1] = p.y; });
  }
  update(video: HTMLVideoElement): TrackingBox | null {
    this.read(video, this.current);
    const next = new Float32Array(160), back = new Float32Array(160);
    const status = new Uint8Array(80), reverse = new Uint8Array(80);
    jsfeat.optical_flow_lk.track(this.previous, this.current, this.points, next, this.count, 15, 30, status, .01, .001);
    jsfeat.optical_flow_lk.track(this.current, this.previous, next, back, this.count, 15, 30, reverse, .01, .001);
    const valid: Array<{ dx: number; dy: number; index: number }> = [];
    for (let i = 0; i < this.count; i++) {
      const x = next[i * 2], y = next[i * 2 + 1];
      if (status[i] && reverse[i] && x > 0 && x < this.width && y > 0 && y < this.height && Math.hypot(back[i * 2] - this.points[i * 2], back[i * 2 + 1] - this.points[i * 2 + 1]) < 1) {
        valid.push({ dx: x - this.points[i * 2], dy: y - this.points[i * 2 + 1], index: i });
      }
    }
    if (valid.length < this.count * .6) return null;
    const motion = consistentMotion(valid);
    if (!motion || Math.hypot(motion.dx, motion.dy) > this.width * .08) return null;
    const box = { ...this.box, x: this.box.x + motion.dx / this.width, y: this.box.y + motion.dy / this.height };
    if (box.x < 0 || box.y < 0 || box.x + box.w > 1 || box.y + box.h > 1) return null;
    const points = new Float32Array(160);
    let count = 0;
    for (const p of valid) {
      if (Math.hypot(p.dx - motion.dx, p.dy - motion.dy) <= 2.5) {
        points[count * 2] = next[p.index * 2]; points[count * 2 + 1] = next[p.index * 2 + 1]; count++;
      }
    }
    this.points = points;
    this.count = count;
    [this.previous, this.current] = [this.current, this.previous];
    this.box = box;
    return { ...box };
  }
}