<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Store player identification anchors as normalized video-frame boxes in the existing marks field; shift-start marking shares the video overlay so letterboxing cannot offset identification coordinates.
- Keep player-identification schemas and grading safeguards in a browser-safe shared module, with extra clues and model evidence stored separately; user descriptions are not proof of identity.
- Save draft shifts, player boxes and identity clues atomically before re-grading; only explicit high-confidence visual evidence permits grades, and note timestamps must fall inside verified on-ice windows.
- Capture small JPEG player crops from newly drawn video boxes and send up to four through Twelve Labs structured reference-image prompts; coordinates alone are descriptive hints, not reliable spatial tracking.
- Re-grades are queued for the existing background worker rather than held open in a browser request, so saving remains fast and feedback polls until processing finishes.
