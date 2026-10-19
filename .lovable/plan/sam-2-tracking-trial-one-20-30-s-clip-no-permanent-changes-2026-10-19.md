# SAM 2 tracking trial (one 20–30 s clip, no permanent changes)

## Goal
Find out whether SAM 2 keeps following the right player better than the current arrow tracker when skaters in identical uniforms cross paths. Grading, manual boxes, review and approval stay exactly as they are.

## Recommended hosted endpoint: fal.ai `fal-ai/sam2/video`
I checked this against fal's published model page (`fal.ai/models/fal-ai/sam2/video/llms.txt`):

- Queue URL: `POST https://queue.fal.run/fal-ai/sam2/video`, header `Authorization: Key <FAL_KEY>`
- Input fields (exact names):
  - `video_url` (string, required)
  - `box_prompts`: array of `{ x_min, y_min, x_max, y_max, frame_index }`, in video pixels
  - `prompts`: array of `{ x, y, label, frame_index }` (optional points)
  - `apply_mask` (bool, default false), `mask_url` (optional), `boundingbox_zip` (bool, default false)
- Output fields:
  - `video` (File: `url`, `content_type`, `file_name`, `file_size`): the segmented video
  - `boundingbox_frames_zip` (File, optional): per-frame box overlays as a zip

What the docs don't say:
- The output is a video and overlay images, not a list of numbers. So the docs don't promise per-frame coordinates.
- The listed price ("$0 per compute second") is clearly a placeholder.

**Step 0 below confirms both on a real call before any app code is written.** If the overlay zip turns out to contain no usable coordinates, I'll get boxes from the mask video by finding the colored area in each frame. If neither works, we stop and I report back. No field names will be made up.

Alternative if fal fails: Replicate hosts community SAM 2 video models. I'd verify their contract the same way before switching.

## Step 0: Contract check (no app code)
1. You add a fal API key (secure form, stored as `FAL_KEY`, server-only).
2. From my sandbox, I submit your test clip once with one box, then save the raw response and output files.
3. I inspect them:
   - Is the frame count and frame rate the same as the input?
   - Is the mask a solid color on black, or blended over the footage?
   - Is there anything usable in the zip?
   - What did the call actually cost (from your fal dashboard)?
4. I report the findings. Only then do I continue to step 1.

## Step 1: Pick the test clip and starting box
- Pick a 20–30 s stretch of an existing upload where you're on the ice and cross paths with at least one same-color teammate.
- New trial page: choose the clip, a start time, and a length (max 30 s). Then draw one box on the first frame, using the existing box tool.
- The browser cuts that stretch into a short MP4 (same approach as the existing video shrinker) and uploads it to a private trial folder in storage. The original upload is untouched.
- The box is converted from the app's 0–1 screen coordinates to pixels: `x_min = x*W`, `y_min = y*H`, `x_max = (x+w)*W`, `y_max = (y+h)*H`, `frame_index = 0`.

## Step 2: Submit securely
- A signed-in-only server function checks that you own the clip and checks the box values. It then creates a short-lived signed link to the trial clip and sends `video_url` + `box_prompts` to fal's queue.
- The fal key never reaches the browser. The signed link expires after about an hour.
- The fal request ID is saved on a new trial record. The page checks for completion every few seconds, so nothing is held open.
- When fal finishes, the server copies the output files into private storage, because fal links can expire.

## Step 3: Turn masks into timestamped positions
- In the browser, the returned mask video plays frame by frame onto a hidden canvas. For each frame, the app finds the bounding box of the mask pixels.
- The pixel box is converted back to 0–1 coordinates. Time = clip start + `frame_index / fps`, so positions line up with the original video.
- Frames with an empty or tiny mask count as "lost".
- Result: a list of `{ time, x, y, w, h, area, lost }` saved on the trial record only. It is never written into your manual boxes.

## Step 4: Side-by-side comparison
Two panes play the same clip in sync:
- **Left:** the existing Lucas–Kanade arrow, started from the same box. Its per-frame positions are recorded.
- **Right:** SAM 2 positions drawn as a box.
- One timeline under both shows green (tracking), red (lost) and amber (you flagged it) for each tracker.

## Step 5: Measurements (you label, the app counts)
Playback pauses every 2 s. At each pause you mark each tracker: **On me / On wrong player / Lost**. You can also redraw a correct box, which counts as a manual correction.
- **Correct-player coverage:** share of checkpoints marked "On me".
- **Identity switches:** times a tracker goes from "On me" to "On wrong player".
- **Tracking failures:** number and total seconds of "Lost".
- **Manual corrections:** how many boxes you had to redraw.
- **Crossing moments:** you tag the times players cross. The same counts are reported just for ±2 s around those times, since that's the real question.

A summary card compares both trackers.

**Suggested pass bar:**
- SAM 2 coverage at least 85% and at least 20 points higher than the arrow
- At most 1 identity switch at crossings

## What stays unchanged
- These stay the same: `PlayerTrackingArrow.tsx`, `player-tracker.ts`, `PlayerPen.tsx`, `highlight.ts`, `VideoReview.tsx`, `HighlightEditor.tsx`, the analysis worker, Twelve Labs code, and the approval trigger.
- Trial data lives in its own table and storage folder.
- Nothing from a trial feeds into grading or approval.
- Removing the trial means deleting one page, one server file, and one table.

## Costs (estimates, confirmed in step 0)
- fal charges per GPU-second. A 30 s 720p clip (around 450–900 frames) usually takes about 1–3 minutes of GPU time, which works out to roughly $0.10–$1 per run. Expect fewer than 10 runs for the whole trial.
- No extra Twelve Labs cost, because the trial doesn't grade anything.
- Storage use is tiny (a few clips of about 10–30 MB).

## Your manual setup
1. Create a fal.ai account and add a payment method.
2. Create an API key in fal's dashboard.
3. Paste it into the secure form I'll open (`FAL_KEY`).
4. Upload or choose one clip where you cross paths with teammates.
5. Do the labeling pass (about 10–15 minutes).

## Technical details
- New files: `src/routes/sam-trial.tsx` (signed-in only) and `src/lib/sam-trial.functions.ts`. The server functions use `requireSupabaseAuth` and are submit/status only. They also include `src/lib/sam-trial.ts`, browser-safe helpers for pixel↔0–1 conversion, frame→time and metrics, plus tests.
- New table `sam_trials`:
  - `id`, `user_id`, `analysis_id`, `clip_start`, `clip_end`, `fps`, `width`, `height`, `start_box`, `fal_request_id`, `status`, `output_path`, `sam_track`, `lk_track`, `labels`, `metrics`, timestamps
  - Owner-only security rules and grants
- Status check: fal queue `GET .../requests/{id}/status`, then the result. I'll use the exact URLs fal returns at submit, confirmed in step 0.
- Tests cover the box conversions (round-trip), frame-to-time mapping, coverage, switch counting and the crossing-window metrics.
- One link from the Feedback page labeled "Tracking trial (experimental)".
