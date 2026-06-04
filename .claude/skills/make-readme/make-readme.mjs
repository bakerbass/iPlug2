#!/usr/bin/env node
// make-readme.mjs - build an iPlug2 plugin, screenshot its UI, and scaffold a README.
//
// Usage:
//   node make-readme.mjs <ProjectName> [--no-build] [--shot-only]
//   node make-readme.mjs                     (auto-detect project from cwd)
//
// What it does, in order:
//   1. Resolves the project dir (Examples/<name> or MyProjects/<name>, or cwd).
//   2. Builds the standalone APP target (Debug x64) via MSBuild, unless --no-build.
//   3. Runs <Name>_x64.exe --screenshot resources/screenshot.png  (high-DPI capture).
//   4. Parses config.h, the params enum + Init*() calls, the .sln targets, and the
//      DSP sources to detect the signal chain.
//   5. Writes <project>/README.md with the screenshot, a signal-flow section, a
//      parameter table, and build instructions.
//
// Windows-only (uses MSBuild.exe and the Windows standalone exe).

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';

const skillDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(skillDir, '..', '..', '..'); // .claude/skills/make-readme -> iPlug2 root

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const positional = args.filter(a => !a.startsWith('--'));

function die(msg) { console.error(`\n[make-readme] ERROR: ${msg}\n`); process.exit(1); }
function log(msg) { console.log(`[make-readme] ${msg}`); }

// ---- 1. Resolve project dir ----------------------------------------------
function findProjectDir(name) {
  if (name) {
    for (const base of ['Examples', 'MyProjects']) {
      const p = join(repoRoot, base, name);
      if (existsSync(join(p, 'config.h'))) return p;
    }
    if (existsSync(join(name, 'config.h'))) return resolve(name); // explicit path
    die(`could not find a project named "${name}" with a config.h under Examples/ or MyProjects/`);
  }
  if (existsSync(join(process.cwd(), 'config.h'))) return process.cwd();
  die('no project name given and the current directory has no config.h');
}

const projectDir = findProjectDir(positional[0]);
const projectName = basename(projectDir);
log(`project: ${projectName}`);
log(`dir:     ${projectDir}`);

// ---- helpers ---------------------------------------------------------------
function read(path) { return existsSync(path) ? readFileSync(path, 'utf8') : ''; }
function walk(dir, exts, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'build-win' || e.name === 'build-mac') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, exts, acc);
    else if (exts.some(x => e.name.endsWith(x))) acc.push(full);
  }
  return acc;
}

// ---- 2. Build the standalone app ------------------------------------------
const sln = join(projectDir, `${projectName}.sln`);
if (!existsSync(sln)) die(`no solution file at ${sln}`);

if (!flags.has('--no-build') && !flags.has('--shot-only')) {
  log('building standalone app (Debug x64)...');
  try {
    execFileSync('MSBuild.exe',
      [sln, '/p:Configuration=Debug', '/p:Platform=x64', `/t:${projectName}-app`, '/nologo', '/v:minimal'],
      { cwd: projectDir, stdio: 'inherit' });
  } catch (e) {
    die('build failed - fix compile errors first (see output above)');
  }
}

// ---- 3. Screenshot ---------------------------------------------------------
const exe = join(projectDir, 'build-win', `${projectName}_x64.exe`);
if (!existsSync(exe)) die(`built exe not found at ${exe} (build the app target first)`);

const resourcesDir = join(projectDir, 'resources');
if (!existsSync(resourcesDir)) mkdirSync(resourcesDir, { recursive: true });
const shotPath = join(resourcesDir, 'screenshot.png');

log('capturing UI screenshot...');
execFileSync(exe, ['--screenshot', shotPath], { cwd: projectDir });
if (!existsSync(shotPath) || statSync(shotPath).size < 1000) die('screenshot was not produced (or is empty)');
log(`screenshot: ${shotPath} (${Math.round(statSync(shotPath).size / 1024)} KB)`);

if (flags.has('--shot-only')) { log('done (--shot-only)'); process.exit(0); }

// ---- 4. Parse metadata -----------------------------------------------------
const config = read(join(projectDir, 'config.h'));
const def = (k, dflt = '') => {
  const m = config.match(new RegExp(`#define\\s+${k}\\s+(.+)`));
  return m ? m[1].trim().replace(/^"|"$/g, '') : dflt;
};
const plugName = def('PLUG_NAME', projectName);
const plugType = def('PLUG_TYPE', '0');
const typeLabel = { '0': 'audio effect', '1': 'instrument', '2': 'MIDI effect' }[plugType] || 'plugin';
const channelIO = def('PLUG_CHANNEL_IO', '2-2');
const subcat = def('VST3_SUBCATEGORY') || def('CLAP_FEATURES');
const doesMidi = def('PLUG_DOES_MIDI_IN', '0') === '1';

// I/O description from PLUG_CHANNEL_IO ("2-2 1-1")
const ioPairs = channelIO.split(/\s+/).filter(Boolean).map(p => {
  const [i, o] = p.split('-');
  const name = n => ({ '1': 'mono', '2': 'stereo' }[n] || `${n}-channel`);
  return `${name(i)} → ${name(o)}`;
});

// Params: enum names + Init*() display names from the source.
const headers = walk(projectDir, ['.h', '.cpp']);
const allSrc = headers.map(read).join('\n');
const enumBlock = (allSrc.match(/enum\s+EParams\s*\{([\s\S]*?)\}/) || [, ''])[1];
const enumIds = [...enumBlock.matchAll(/\b(k[A-Z]\w*)\b/g)].map(m => m[1])
  .filter(id => id !== 'kNumParams' && !/^kNum/.test(id));
const initNames = {};
for (const m of allSrc.matchAll(/GetParam\(\s*(k\w+)\s*\)\s*->\s*Init\w+\(\s*"([^"]*)"/g))
  initNames[m[1]] = m[2];
const paramRows = enumIds.map(id => {
  const display = initNames[id] || id.replace(/^k/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
  return `| ${display} | \`${id}\` |`;
});

// Build targets from the .sln
const targets = [...read(sln).matchAll(new RegExp(`"${projectName}-(\\w+)"`, 'g'))].map(m => m[1]);

// Detect DSP building blocks for the signal-flow section.
const detectors = [
  [/\bSVF\b|StateVariableFilter/, 'State-variable filterbank (resonant band filters)'],
  [/ADSREnvelope/, 'ADSR / grain envelopes'],
  [/\bLFO\b/, 'LFO modulation'],
  [/Oscillator|FastSinOscillator/, 'Oscillator(s)'],
  [/delay_line|DelayLine|NChanDelay/, 'Delay line'],
  [/IPeakAvgSender|IPeakSender/, 'Peak/RMS metering to UI'],
  [/ISpectrumSender|FFT/, 'FFT / spectral analysis to UI'],
  [/IBufferSender/, 'Waveform/scope data to UI'],
  [/ISender/, 'Audio→UI data sender'],
  [/biquad|RBJ/, 'Biquad filtering'],
  [/Sequencer|mStepIdx|mPattern/, 'Step sequencer'],
];
const blocks = detectors.filter(([re]) => re.test(allSrc)).map(([, label]) => label);

// Project layout (top-level source files + DSP/GUI dirs)
const layout = [];
for (const f of ['config.h', `${projectName}.h`, `${projectName}.cpp`])
  if (existsSync(join(projectDir, f))) layout.push(f);
for (const d of ['source', 'DSP', 'GUI'])
  if (existsSync(join(projectDir, d))) layout.push(`${d}/`);

// ---- 5. Write README -------------------------------------------------------
const targetLines = (targets.length ? targets : ['app', 'vst3', 'clap'])
  .map(t => `# ${t.toUpperCase()}`).join('  ');

const signalFlow = [
  `**I/O:** ${ioPairs.join(', ') || channelIO}${doesMidi ? ' (+ MIDI in)' : ''}`,
  '',
  '```',
  `Input ${doesMidi ? '+ MIDI ' : ''}→ ${blocks.length ? blocks.join(' → ') : 'processing'} → Output`,
  '```',
  '',
  blocks.length
    ? 'Detected processing blocks (refine this prose by reading the DSP source):\n' +
      blocks.map(b => `- ${b}`).join('\n')
    : '_Describe the processing chain here._',
].join('\n');

const article = /^[aeiou]/i.test(typeLabel) ? 'An' : 'A';
const readme = `# ${plugName}

${article} ${typeLabel}${subcat ? ` (${subcat})` : ''} built with [iPlug2](https://github.com/iPlug2/iPlug2).

![${plugName} UI](./resources/screenshot.png)

## Signal Flow

${signalFlow}

## Parameters

| Parameter | ID |
|---|---|
${paramRows.join('\n') || '| _none_ | |'}

## Build

Windows (Visual Studio / MSBuild):

\`\`\`powershell
MSBuild.exe ${projectName}.sln /p:Configuration=Release /p:Platform=x64 /t:${projectName}-vst3
\`\`\`

Targets: ${(targets.length ? targets : ['app', 'vst3', 'clap', 'aax']).map(t => `\`${projectName}-${t}\``).join(', ')}.
The default NanoVG graphics backend needs no extra dependencies. On macOS, open
\`${projectName}.xcworkspace\` or build with \`xcodebuild\`.

## Project Layout

\`\`\`
${layout.join('\n') || `${projectName}.h / ${projectName}.cpp`}
\`\`\`
`;

writeFileSync(join(projectDir, 'README.md'), readme);
log(`wrote ${join(projectDir, 'README.md')}`);
log(`done. params: ${enumIds.length}, blocks: ${blocks.length}, targets: ${targets.length}`);
