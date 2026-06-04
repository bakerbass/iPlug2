---
name: make-readme
description: Generate a README for a freshly built iPlug2 plugin - builds the standalone app, captures a high-quality UI screenshot, and scaffolds a README with signal flow, parameter table, and build instructions. Use when asked to make/update a plugin README, document a plugin, or add a screenshot to the docs.
---

# Make a Plugin README

Generates `README.md` for an iPlug2 plugin project. The work is done by a driver
script that builds the standalone app, screenshots its UI, parses `config.h` + the
params + the DSP sources, and writes the README. **Run the driver — don't hand-write
the README from scratch.**

Driver: [.claude/skills/make-readme/make-readme.mjs](make-readme.mjs)
Windows only (uses `MSBuild.exe` and the Windows standalone `--screenshot`).
Commands below are run from the **iPlug2 repo root**.

## Prerequisites

- Node.js (tested on v24) and `MSBuild.exe` on `PATH` (run from a VS Developer prompt,
  or any shell where `which MSBuild.exe` resolves).
- The plugin must compile. The driver builds the **Debug** APP target on purpose —
  only Debug standalone builds expose the `--screenshot` capability.

## Run (agent path)

Build + screenshot + write the README in one shot:

```bash
node .claude/skills/make-readme/make-readme.mjs Squiggly
```

If the app is already built and you only want to refresh the screenshot + README:

```bash
node .claude/skills/make-readme/make-readme.mjs Squiggly --no-build
```

Just (re)capture the screenshot, skip the README:

```bash
node .claude/skills/make-readme/make-readme.mjs Squiggly --shot-only
```

The project name resolves against `Examples/<name>` and `MyProjects/<name>`; with no
name it uses the current directory (must contain `config.h`). Output:

- `<project>/resources/screenshot.png` — high-DPI UI capture, embedded in the README.
- `<project>/README.md` — title, screenshot, **Signal Flow**, parameter table, build
  instructions, project layout.

The driver prints a summary line, e.g. `done. params: 15, blocks: 5, targets: 5`.

## After running: refine the signal flow

The **Signal Flow** section is auto-detected from DSP keywords (SVF, ADSREnvelope,
ISender, delay lines, sequencer state, etc.) and listed in detection order — it is a
**scaffold, not final prose**. Read the project's `DSP/` sources and rewrite the chain
into the real order (e.g. for Squiggly: filterbank → grain envelopes → mix, with the
sequencer driving the triggers and senders feeding the UI). Likewise tighten the
one-line intro. Everything else (params, targets, screenshot) is accurate as generated.

## Gotchas

- **Debug build is mandatory for the screenshot.** Release standalone builds don't
  honor `--screenshot` (the capture lives behind the debug menu). The driver always
  builds `-app` in Debug for this reason.
- **The exe the driver runs is the copied one:** `build-win/<Name>_x64.exe` (a postbuild
  copy), not `build-win/app/x64/Debug/<Name>.exe`. Don't point tools at the per-config path.
- **README.md is overwritten** each run. Re-run regenerates the screenshot + scaffold; any
  hand-edited Signal Flow / intro prose is lost, so do your prose edits last.
- **Parameter names** come from the `GetParam(kX)->Init*("Display Name", ...)` calls in the
  source. Params with no `Init*` string fall back to a de-camelCased enum name.
- **`resources/` is created if missing.** Most projects already have it (fonts live there);
  the screenshot lands alongside them and is referenced as `./resources/screenshot.png`.

## Troubleshooting

- `built exe not found at ...` — you passed `--no-build` but never built the app. Re-run
  without `--no-build`.
- `build failed - fix compile errors first` — the MSBuild output is printed above the
  error; fix the code and re-run.
- `MSBuild.exe` not found — open a "Developer PowerShell/Command Prompt for VS" so MSBuild
  is on `PATH`, then re-run.
- `screenshot was not produced` — the app built but didn't capture. Confirm it's a Debug
  build and that `<project>/build-win/<Name>_x64.exe` exists and launches.

## macOS

Not implemented in the driver. The equivalent is `xcodebuild -target APP -configuration
Debug` then `~/Applications/<Name>.app/Contents/MacOS/<Name> --screenshot out.png`
(see the `build` and `screenshot` skills). Port the two `execFileSync` calls if needed.
