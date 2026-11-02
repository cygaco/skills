---
guide: LAUNCH_FILM
anchor: none
shape: walkthrough
timing: reference
lead_time: "none (budget time for the first render: the renderer downloads its own browser)"
---

# LAUNCH_FILM_GUIDE.md — Making a Launch Film With Code (for Total Newbies)

> **Part of the lastmile launch guides** (`.claude/lastmile/guides/`). Read **`README.md`** first for the shared rule about what only YOU can do versus your AI.
>
> **Who this is for:** you want a launch film (a product video) built from code instead of a video editor, and you want it small enough to attach where people will watch it. This guide is the workflow only: tools, steps, settings, licences. What the film says is up to you.

---

## 1. What you are building

A **video folder** on your machine, separate from your product's code. In it you keep the film's source, the rendered clips (`out/`), the assembly scripts and a credits file. A renderer turns code into video frames; ffmpeg joins the clips, mixes the sound and encodes the copies you deliver.

> 🧒 Think of it as a tiny film studio in a folder. Your product's repository is the shop; the studio is next door, so nothing in the shop depends on the studio's tools.

**Rule: the video folder must NOT be inside your product's repository.** This keeps the renderer out of your app's dependencies. Check with `git -C <folder> rev-parse --show-toplevel` and compare it with your product's repository root (for a folder that does not exist yet, check its nearest existing parent); if they match, pick another folder.

## 2. Pick a renderer (and read its licence first)

This guide is tool-agnostic. Any code-driven renderer works if it can output numbered frames or a video file per scene. The worked example below names **Remotion** (React-based), because its scaffold is small.

**Remotion licence, stated honestly.** The worked example pins Remotion 4.0.536, and this wording covers that version. It is free for individuals, for for-profit organisations with up to 3 people, for non-profits, and for evaluators not yet using it commercially. A Company License is required for everyone else (for-profit organisations with a combined headcount of 4 or more). The licence changes in Remotion 5.0 (`LICENSE.md` line 3).

Licence terms: https://www.remotion.dev/docs/license/terms

Accessed 2026-10-31. Read the page yourself before you install, and after the install read `node_modules/remotion/LICENSE.md`; it governs this install. If you need a Company License, budget for it or choose a different renderer.

## 3. Tools you need

| Tool | Why |
|---|---|
| Node | runs the renderer and any audio scripts |
| ffmpeg **and** ffprobe on your PATH | assembly, loudness, encoding |
| bash (Git Bash on Windows) | the assembly scripts |

A first render downloads the renderer's own headless browser into the video folder; nothing else is installed system-wide.

## 4. Scaffold (Remotion example)

Create the layout: `package.json`, `tsconfig.json`, `remotion.config.ts`, `src/` (entry `index.ts`, composition registration in `Root.tsx`), `public/`, `out/`, `tools/`, `CREDITS.md`, and a `.gitignore` containing `node_modules/` and `out/`.

Rules that matter:

- Every `remotion` and `@remotion/*` package is pinned to **one identical exact version** (no `^`, no `~`). Mixed versions break renders.
- Self-host fonts with `@fontsource/*` so renders are the same offline and on every machine.
- TypeScript is only used to typecheck (`noEmit`); `moduleResolution: bundler` needs TypeScript 5 or newer.
- Compose at 1920x1080 and 30 fps.

Ask your AI to scaffold these files from the rules above.

## 5. Render

1. **Stills first.** Render a few single frames (`npx remotion still src/index.ts Main out/check.png --frame=0`). This is a technical check for render errors, framing and missing assets. Stills are cheap; full renders are not.
2. **Then video**, one clip per scene into `out/`:
   `npx remotion render src/index.ts Main out/main.mp4 --gl=angle --crf=16 --codec=h264 --pixel-format=yuv420p`
3. `--gl=angle` is needed for WebGL content and is the reliable choice on Windows. `--crf=16` is intermediate quality (the final encode sets delivery quality). Leave concurrency at its default unless renders run out of memory; then add `--concurrency=<n>` and lower it.
4. To change the cut, edit the parts list and re-assemble (seconds). Do not re-render to re-cut.

## 6. Assemble and encode

The assembly script (ask your AI to write it) does, in order: join clips (optional trim per clip); pad or cut each clip's audio to its exact video length (clips with no audio get silence); optional score mixed in; loudness measured then applied in two passes with a limiter; one master encode (libx264, crf 18, yuv420p, AAC 192k, faststart).

Traps worth knowing:

- Take a clip's duration from its **video** stream, not the container; a container can include an audio tail and drift sync.
- A two-pass encode needs a pass 1 that writes nothing. Use `-f null -`; a file named `NUL` is created as a real file on Linux and macOS.
- Strip carriage returns (`tr -d '\r'`) from lists edited on Windows.

## 7. Delivery copies

**Bitrate, not resolution, sets file size.** To hit a size cap: total bitrate ≈ cap × 8 / duration; target video bitrate ≈ cap × 8 / duration − audio bitrate, with a margin. Check your channel's current limit, then compute. Then check the real size: if the copy is over the cap, re-encode once at the video bitrate scaled by (cap / actual size) × 0.95; if it is still over, stop and report the file, its size and the cap.

| Copy | Encode settings | Size cap | Source |
|---|---|---|---|
| Master | 1080p, crf 18 | none of ours; the platform's upload limit applies | check the platform |
| Web / self-host | 1080p, about 6 Mbps (maxrate 7.5M) | none | n/a |
| GitHub issue / pull request / comment video attachment | 720p two-pass, about 600k video + 64k audio | 10 MB when the repository is on a free GitHub plan, 100 MB on a paid plan | docs.github.com, Attaching files page, accessed 2026-10-31 |

Keep the rendered video out of git history (gitignore `out/`) and attach or upload each copy where the target platform expects it.

## 8. Sound and music: options

You choose; none is required. Record every asset's source URL and licence in `CREDITS.md`.

- **Music generated in code**: a script writes a WAV; no licence questions, and you re-render the audio when timing changes.
- **jsfxr** for 8-bit sound effects (The Unlicense).
- **Kenney packs** (CC0). Keep each pack's licence file with the files. The Kenney logo is reserved and is not covered.
- **Mixkit** items showing the Free licence only. Check each item; do not assume.
- **Paid generators**: only with your explicit approval. They cost money and need accounts.

## 9. Fact-check table

Every number or licence claim above that comes from outside this guide, with where it came from.

| fact | value | source | accessed |
|---|---|---|---|
| Remotion licence, free use | Version 4.0.536: individuals, for-profit organisations with up to 3 people, non-profits, evaluators not yet using it commercially; changes in Remotion 5.0 | https://www.remotion.dev/docs/license/terms | 2026-10-31 |
| Remotion Company License | Required for everyone else (for-profit organisations with a combined headcount of 4 or more) | https://www.remotion.dev/docs/license/terms | 2026-10-31 |
| GitHub video attachment on an issue, pull request or comment | 10 MB when the repository is on a free GitHub plan, 100 MB on a paid plan | https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files | 2026-10-31 |
| Kenney assets | CC0; attribution not required; logo reserved | https://kenney.nl/support | 2026-10-31 |
| Mixkit Free licence | Commercial use without attribution for items marked Free; Restricted items are non-commercial; check each item | https://mixkit.co/license/ ; https://mixkit.co/llm-info/ ; https://mixkit.co/free-sound-effects/ | 2026-10-31 |
| jsfxr | The Unlicense (public domain) | https://github.com/chr15m/jsfxr | 2026-10-31 |

## 10. Before you hit publish

- [ ] The video folder is outside your product's repository.
- [ ] You read the renderer licence and, after the install, `node_modules/remotion/LICENSE.md`.
- [ ] Every asset has a line in `CREDITS.md` with source URL and licence.
- [ ] You checked the real upload limit of each place you will attach the film.
- [ ] No paid generator ran without your approval.
