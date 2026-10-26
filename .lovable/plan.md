# Roboflow detection + SAM 2 selected-player trial

## What you get
On the existing experimental tracking page, Roboflow proposes boxes around visible hockey players. You select your player and correct the box if needed. SAM 2 then tracks that selected player through the short clip. Review stays required, and Twelve Labs coaching stays unchanged.

**Detection is not personal identification:** Roboflow will not automatically know who is Max Hu or guarantee that every player is found. SAM 2 can still switch players during crossings. Hidden players cannot reliably be detected.

## BoT-SORT alternative to evaluate before implementation
BoT-SORT is a multi-object tracker, not a player detector. A hockey detector supplies boxes on consecutive frames; BoT-SORT associates them into numbered tracks. These track IDs are not jersey numbers or confirmed personal identities. This is a better-matched candidate when the goal expands from following one selected player to tracking all visible skaters.

- Compare detector + BoT-SORT against the existing selected-player SAM 2 trial on the same short crossing-heavy clip before choosing the production approach.
- Supply consecutive-frame detections, not the two-second samples proposed below; sampled detections alone are not a valid BoT-SORT video-tracking trial.
- Keep the user’s first-frame selection as the target identity anchor. Review the resulting target track for identity switches and lost periods, rather than treating track ID persistence as proof of identity.
- Same uniforms and occlusions remain difficult; appearance matching cannot guarantee correct re-identification. Verify the chosen implementation’s appearance model and configuration explicitly.
- Ultralytics BoT-SORT disables appearance re-identification by default (`with_reid: False`); compare deliberate ReID settings rather than assuming it is active. Review Ultralytics AGPL/Enterprise licensing separately from the original BoT-SORT repository’s MIT license.
- Verify a real hosted processing service, model licensing, credentials, input/output contract, and costs before proposing a BoT-SORT integration. Its standard video pipeline does not run inside this app’s hosted server runtime.
- Keep SAM 2 as the comparison baseline or possible later selected-player tool; do not immediately chain all three systems or add automatic reacquisition.

This alternative changes the potential test scope, not the existing app. No tracker is replaced while the approach is being evaluated.

## 1. Verify Roboflow access and the actual detector first
- Roboflow is not currently connected. Its private API key will be collected in a secure form after approval, never in chat or browser code.
- Start by checking the published hockey detector `hockey-player-detection-smgfc/1`, which lists player and referee classes. This is a candidate, not a validated model for your rink footage.
- Confirm model availability, access, license, deployment, exact HTTP image input and prediction response, and current inference pricing using its deployment instructions and a real call on a frame from your clip.
- Inspect predictions on clear frames and crowded crossings. If access fails or it performs poorly, stop and report the results; choose or deploy a suitable model before continuing. Do not invent a working model or silently substitute a generic person detector.
- Roboflow usage is separate from fal credits. Confirm the account’s free allowance or charges before running a batch; no unverified cost estimate.

## 2. Extend the trial, not the coaching workflow
- Use the same 20–30-second trial clip for detection and tracking.
- Add an optional **Find players** action at the start frame. Show detector candidates and let you select or adjust one. Keep manual boxing available when detection misses you.
- Sample additional frames at the existing two-second review checkpoints to show all detected player candidates there. Describe these as sampled detections, not continuous tracks for all players.
- Include referees/goalies only as separate classes when the selected model actually supports them. Review bench detections and missed skaters; do not claim a certified on-ice player count without an on-ice region and manual validation.
- Send only your confirmed selection to the existing SAM 2 service. Never automatically switch to the closest detection after an overlap or loss. Ask for a new selection when identity cannot be confirmed.

## 3. Make comparison trustworthy
- Align selection with the actual decoded first frame of the trimmed clip. Changing the start time clears stale selection and detections.
- Use the trimmed video’s actual dimensions, not a fixed width assumption. Keep overlays inside the displayed video frame so black bars cannot shift boxes.
- Synchronize the existing arrow and SAM 2 playback to the same timestamp and selection.
- Keep the existing On me / Wrong player / Lost review and crossing labels. Separately record detector misses, false positives, and selection corrections.
- Present sampled correct-player coverage, observed identity switches, lost checkpoints, and manual corrections. Do not present checkpoint results as proof of correctness on every frame.

## Security and storage
- Require sign-in and verify trial ownership before using either provider’s paid credentials, generating storage links, or reading/writing results.
- Audit the existing trial functions during this integration: they currently use privileged access without session checks, contrary to the earlier intended signed-in trial. Protect all sibling trial actions before connecting another paid service.
- Establish ownership for any existing trial records; never assign another person’s trials to the current caller automatically.
- Keep provider keys server-only. Send selected JPEG frames to Roboflow and a temporary private clip link to fal. Provider processing means those services receive that footage.
- Store trial detections separately from saved Feedback anchors, verified ranges, and coaching evidence. No trial result grants grading identity or approval.

## Technical details
- Extend `src/routes/sam-trial.tsx` with detection and candidate selection; create focused detection helpers and tests.
- Use authenticated TanStack server functions and fetch-based HTTP calls, not a browser API key or a local Python/GPU process.
- Existing SAM 2 submission remains `POST https://queue.fal.run/fal-ai/sam2/video` with `video_url` and `box_prompts` containing `{x_min, y_min, x_max, y_max, frame_index}` in trimmed-video pixels.
- Roboflow documentation identifies `https://serverless.roboflow.com` and project/version model inference. Exact raw HTTP request and output parsing must be verified for the selected deployment before implementation; the SDK examples alone are not enough to invent fields.
- Normalize returned pixel boxes using the dimensions of the image actually submitted. Add original-video time as `clipStart + frameIndex / fps` where applicable; retain frame indices and decoded timing for alignment.
- Add tests for box conversions, selection invalidation, coordinate bounds, ownership access, and the rule that detector output cannot auto-reassign identity. Run relevant existing trial tests and verify the real clip flow when credentials and playable footage are available.
- Leave `PlayerPen.tsx`, `highlight.ts`, the Feedback review gate, the Twelve Labs analysis worker, and grading safeguards unchanged.

## References
- [Official BoT-SORT repository](https://github.com/NirAharon/BoT-SORT)
- [Ultralytics tracking configuration](https://docs.ultralytics.com/modes/track)
- [Roboflow Serverless API](https://docs.roboflow.com/deployment/roboflow-cloud/serverless-api)
- [Roboflow inference SDK](https://docs.roboflow.com/reference/inference/inference-sdk)
- [Candidate hockey detector](https://universe.roboflow.com/hockey-cr8j8/hockey-player-detection-smgfc)
- [Roboflow inference pricing](https://docs.roboflow.com/deployment/roboflow-cloud/serverless-api/pricing)

## Current blockers
Roboflow credentials and real detector verification are missing. Existing real-footage comparison and coaching verification remain pending your playable footage and identity review. No detection or tracking integration is claimed complete.