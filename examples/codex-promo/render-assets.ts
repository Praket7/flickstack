import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { serializeProject, type FlickProject } from '../../packages/schema/src/project.ts';

const ROOT = process.cwd();
const DIR = resolve(ROOT, 'examples/codex-promo');
const WORK = join(DIR, 'work');
const OUT = join(DIR, 'out');
const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const BPM = 120;
const BEAT = FPS * 60 / BPM; // 15 frames

const scenes = [
  { id: 'hook', label: 'Hook', duration: 60 },
  { id: 'prompt', label: 'Prompt and send', duration: 150 },
  { id: 'parallel', label: 'Parallel agent work', duration: 180 },
  { id: 'diff', label: 'Diff and tests', duration: 150 },
  { id: 'browser', label: 'Browser verification', duration: 150 },
  { id: 'computer', label: 'Computer use and feedback', duration: 150 },
  { id: 'review', label: 'PR review', duration: 180 },
  { id: 'montage', label: 'Workflow montage', duration: 150 },
  { id: 'end', label: 'End card', duration: 90 },
] as const;

const TOTAL_FRAMES = scenes.reduce((sum, scene) => sum + scene.duration, 0);
const TOTAL_SECONDS = TOTAL_FRAMES / FPS;

function esc(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
function clamp(v: number, lo = 0, hi = 1): number { return Math.max(lo, Math.min(hi, v)); }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function ease(t: number): number { const x = clamp(t); return 1 - Math.pow(1 - x, 3); }
function enter(f: number, at = 0, len = 12): number { return ease((f - at) / len); }
function exit(f: number, at: number, len = 8): number { return 1 - ease((f - at) / len); }
function alpha(v: number): string { return clamp(v).toFixed(3); }
function n(v: number): string { return Number(v.toFixed(2)).toString(); }

const C = {
  bg: '#0b0d0e',
  panel: '#111416',
  panel2: '#171b1d',
  panel3: '#202528',
  line: '#2a3033',
  text: '#f3f5f4',
  muted: '#9da5a2',
  faint: '#69716f',
  green: '#4ade9a',
  green2: '#1f7a55',
  amber: '#e8b66c',
  red: '#f17b79',
  blue: '#7db3ff',
};

function rect(x: number, y: number, w: number, h: number, fill: string, r = 0, opacity = 1, stroke?: string): string {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(r)}" fill="${fill}" fill-opacity="${alpha(opacity)}"${stroke ? ` stroke="${stroke}" stroke-width="1"` : ''}/>`;
}
function line(x1: number, y1: number, x2: number, y2: number, stroke: string, width = 1, opacity = 1): string {
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${alpha(opacity)}" stroke-linecap="round"/>`;
}
function circle(cx: number, cy: number, r: number, fill: string, opacity = 1, stroke?: string): string {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}" fill-opacity="${alpha(opacity)}"${stroke ? ` stroke="${stroke}" stroke-width="1"` : ''}/>`;
}
function text(x: number, y: number, value: string, size = 30, fill = C.text, weight = 500, opacity = 1, anchor: 'start'|'middle'|'end' = 'start', mono = false, letterSpacing = 0): string {
  const family = mono ? 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace' : 'Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
  return `<text x="${n(x)}" y="${n(y)}" fill="${fill}" fill-opacity="${alpha(opacity)}" font-size="${size}" font-weight="${weight}" font-family="${family}" text-anchor="${anchor}" letter-spacing="${letterSpacing}">${esc(value)}</text>`;
}
function pill(x: number, y: number, label: string, fill: string, color: string, opacity = 1): string {
  const w = 28 + label.length * 8.8;
  return rect(x, y - 23, w, 34, fill, 17, opacity) + text(x + 14, y, label, 15, color, 650, opacity);
}
function cursor(x: number, y: number, opacity = 1): string {
  return `<path d="M ${n(x)} ${n(y)} L ${n(x + 3)} ${n(y + 25)} L ${n(x + 10)} ${n(y + 18)} L ${n(x + 18)} ${n(y + 31)} L ${n(x + 24)} ${n(y + 27)} L ${n(x + 16)} ${n(y + 14)} L ${n(x + 26)} ${n(y + 10)} Z" fill="#ffffff" fill-opacity="${alpha(opacity)}" stroke="#0b0d0e" stroke-width="2"/>`;
}
function topChrome(title = 'Codex'): string {
  return rect(36, 28, 1848, 1024, '#0e1112', 22, 1, '#24292b') +
    rect(36, 28, 1848, 52, '#15191b', 22) +
    rect(36, 60, 1848, 20, '#15191b') +
    circle(62, 54, 6, '#ff605c') + circle(84, 54, 6, '#ffbd44') + circle(106, 54, 6, '#00ca4e') +
    text(138, 61, title, 16, '#c6ceca', 600);
}
function sidebar(active: string, opacity = 1): string {
  let s = rect(36, 80, 316, 972, '#0f1213', 0, opacity) + line(352, 80, 352, 1052, C.line, 1, opacity);
  s += text(70, 126, 'CODEX', 16, C.muted, 750, opacity, 'start', false, 2.4);
  s += rect(64, 158, 258, 38, '#171b1d', 9, opacity) + text(82, 183, '⌕  Search threads', 15, C.muted, 500, opacity);
  s += text(70, 236, 'PROJECT', 12, C.faint, 700, opacity, 'start', false, 1.6);
  s += text(70, 270, 'flickstack', 17, C.text, 650, opacity);
  const items = ['Ship pricing page', 'Fix renderer regression', 'Review PR #128', 'Refactor audio bus'];
  items.forEach((item, i) => {
    const y = 316 + i * 52;
    if (item === active) s += rect(58, y - 29, 274, 42, '#202527', 9, opacity);
    s += circle(77, y - 8, 4, item === active ? C.green : C.faint, opacity);
    s += text(92, y - 2, item, 15, item === active ? C.text : C.muted, item === active ? 650 : 500, opacity);
  });
  s += text(70, 1000, 'Local  •  main', 13, C.faint, 550, opacity);
  return s;
}
function appShell(active = 'Ship pricing page', title = 'flickstack'): string {
  return topChrome(title) + sidebar(active);
}
function sectionHeader(x: number, y: number, title: string, subtitle?: string, opacity = 1): string {
  let s = text(x, y, title, 20, C.text, 700, opacity);
  if (subtitle) s += text(x, y + 27, subtitle, 14, C.muted, 500, opacity);
  return s;
}
function sceneFlash(f: number): string {
  const beatPhase = (f % BEAT) / BEAT;
  const a = beatPhase < 0.08 ? (0.08 - beatPhase) / 0.08 * 0.08 : 0;
  return rect(0, 0, WIDTH, HEIGHT, '#ffffff', 0, a);
}
function svg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><defs><linearGradient id="heroGlow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d2426"/><stop offset="1" stop-color="#0b0d0e"/></linearGradient><filter id="soft"><feGaussianBlur stdDeviation="18"/></filter><filter id="tiny"><feGaussianBlur stdDeviation="4"/></filter></defs>${body}</svg>`;
}

function sceneHook(f: number): string {
  const a = enter(f, 0, 10);
  const t2 = enter(f, 18, 10);
  const t3 = enter(f, 36, 8);
  const shift = lerp(36, 0, ease(f / 18));
  let s = rect(0, 0, WIDTH, HEIGHT, C.bg);
  s += circle(1415, 292, 250, '#22302d', 0.22 * a) + circle(1510, 235, 130, '#3b4b46', 0.12 * a);
  s += text(160, 430 + shift, 'A repo full of work.', 66, C.muted, 520, a);
  s += text(160, 522 + shift, 'One message.', 108, C.text, 760, t2);
  s += text(160, 620 + shift, 'Codex gets moving.', 108, C.text, 760, t3);
  s += line(160, 682, 480, 682, C.green, 6, t3);
  s += text(160, 744, 'Real workflow. Real code. Real verification.', 24, C.muted, 500, t3);
  s += sceneFlash(f);
  return svg(s);
}

const promptStages = [
  'Ship',
  'Ship the responsive',
  'Ship the responsive pricing page.',
  'Ship the responsive pricing page. Match',
  'Ship the responsive pricing page. Match the screenshots.',
  'Ship the responsive pricing page. Match the screenshots. Run',
  'Ship the responsive pricing page. Match the screenshots. Run tests.',
];
function scenePrompt(f: number): string {
  const a = enter(f, 0, 8);
  let s = rect(0, 0, WIDTH, HEIGHT, C.bg) + appShell('Ship pricing page', 'flickstack');
  s += text(398, 132, 'Ship pricing page', 24, C.text, 700, a);
  s += pill(1644, 132, 'Local', '#17221e', C.green, a);
  s += line(386, 162, 1852, 162, C.line, 1, a);
  const cardA = enter(f, 12, 10);
  s += rect(430, 230, 1060, 120, C.panel2, 18, cardA, C.line);
  s += text(466, 276, 'Project', 13, C.faint, 650, cardA);
  s += text(466, 318, '~/dev/flickstack', 24, C.text, 650, cardA, 'start', true);
  s += pill(1280, 307, 'main', '#202729', '#d8dfdc', cardA);
  const promptA = enter(f, 30, 10);
  s += rect(430, 404, 1060, 236, '#121617', 22, promptA, '#343a3c');
  s += text(466, 448, 'Message Codex', 14, C.faint, 650, promptA);
  const stage = clamp(Math.floor((f - 48) / 14), 0, promptStages.length - 1);
  const prompt = f < 48 ? '' : promptStages[stage];
  s += text(466, 516, prompt, 25, C.text, 520, promptA);
  if (f >= 48 && f < 142 && (Math.floor(f / 9) % 2 === 0)) s += rect(466 + Math.min(870, prompt.length * 13.1), 486, 2, 36, C.text, 0, 0.85);
  s += rect(1382, 574, 72, 42, f > 121 ? C.text : C.panel3, 12, promptA);
  s += text(1418, 601, '↑', 24, f > 121 ? '#0b0d0e' : C.faint, 800, promptA, 'middle');
  const send = enter(f, 121, 6);
  if (f > 121) {
    s += circle(1418, 595, 28 + 24 * clamp((f - 121) / 12), C.green, 0.22 * exit(f, 132, 8));
    s += pill(466, 702, 'Working', '#17221e', C.green, send);
    s += text(586, 701, 'Reading AGENTS.md and scanning the repo…', 17, C.muted, 520, send);
  }
  const cx = lerp(1240, 1418, ease((f - 95) / 26));
  const cy = lerp(760, 592, ease((f - 95) / 26));
  s += cursor(cx, cy, clamp((f - 90) / 8));
  s += sceneFlash(f);
  return svg(s);
}

function taskCard(x: number, y: number, w: number, title: string, sub: string, status: string, color: string, progress: number, a: number): string {
  let s = rect(x, y, w, 190, C.panel2, 16, a, C.line);
  s += circle(x + 30, y + 32, 6, color, a);
  s += text(x + 50, y + 39, title, 17, C.text, 680, a);
  s += text(x + 28, y + 78, sub, 14, C.muted, 500, a);
  s += rect(x + 28, y + 112, w - 56, 6, '#252b2d', 3, a);
  s += rect(x + 28, y + 112, (w - 56) * clamp(progress), 6, color, 3, a);
  s += pill(x + 28, y + 160, status, color === C.green ? '#17221e' : '#24211b', color, a);
  return s;
}
function sceneParallel(f: number): string {
  let s = rect(0, 0, WIDTH, HEIGHT, C.bg) + appShell('Ship pricing page', 'flickstack');
  s += text(398, 130, 'Codex is working in parallel', 26, C.text, 720);
  s += text(398, 159, 'Separate worktrees. One goal.', 15, C.muted, 500);
  s += line(386, 183, 1852, 183, C.line);
  const starts = [15, 30, 45];
  const xs = [408, 884, 1360];
  const data = [
    ['Plan', 'Map components and acceptance checks', 'Complete', C.green],
    ['Frontend', 'Implement pricing layout and states', f > 128 ? 'Complete' : 'Editing', f > 128 ? C.green : C.amber],
    ['Tests', 'Add visual and interaction coverage', f > 150 ? 'Complete' : 'Running', f > 150 ? C.green : C.amber],
  ] as const;
  data.forEach((d, i) => {
    const a = enter(f, starts[i], 12);
    const p = clamp((f - starts[i] - 12) / (95 + i * 12));
    s += taskCard(xs[i], 248, 430, d[0], d[1], d[2], d[3], p, a);
  });
  const planA = enter(f, 58, 12);
  s += rect(408, 478, 1382, 440, '#0f1314', 18, planA, C.line);
  s += sectionHeader(444, 526, 'Live plan', 'Codex keeps the work legible while agents execute', planA);
  const steps = [
    ['1', 'Inspect existing tokens and page shell', 'done'],
    ['2', 'Build responsive plan cards', f > 100 ? 'done' : 'active'],
    ['3', 'Wire monthly / annual state', f > 124 ? 'done' : 'queued'],
    ['4', 'Run tests and visual verification', f > 150 ? 'done' : 'queued'],
  ];
  steps.forEach((row, i) => {
    const y = 612 + i * 70;
    const active = row[2] === 'active';
    const done = row[2] === 'done';
    s += circle(464, y - 8, 13, done ? C.green2 : active ? '#5b4a2d' : '#252b2d', planA);
    s += text(464, y - 3, done ? '✓' : row[0], 13, done ? '#c9f9e1' : active ? C.amber : C.faint, 750, planA, 'middle');
    s += text(496, y, row[1], 18, done ? C.muted : C.text, active ? 650 : 520, planA);
    if (active) s += pill(1450, y - 1, 'agent-2', '#24211b', C.amber, planA);
  });
  if (f > 142) {
    const doneA = enter(f, 142, 8);
    s += pill(1540, 952, '3 agents • synced', '#17221e', C.green, doneA);
  }
  s += sceneFlash(f);
  return svg(s);
}

function codeRow(x: number, y: number, numText: string, code: string, kind: 'add'|'del'|'ctx', a = 1): string {
  const bg = kind === 'add' ? '#122019' : kind === 'del' ? '#241617' : 'transparent';
  const c = kind === 'add' ? '#bdebd1' : kind === 'del' ? '#f3c0bf' : '#c8cfcc';
  let s = bg === 'transparent' ? '' : rect(x, y - 24, 886, 31, bg, 0, a);
  s += text(x + 14, y, numText, 13, C.faint, 500, a, 'start', true);
  s += text(x + 62, y, kind === 'add' ? '+' : kind === 'del' ? '-' : ' ', 13, c, 700, a, 'start', true);
  s += text(x + 88, y, code, 14, c, 500, a, 'start', true);
  return s;
}
function sceneDiff(f: number): string {
  let s = rect(0, 0, WIDTH, HEIGHT, C.bg) + appShell('Ship pricing page', 'flickstack');
  s += text(398, 130, 'Changes', 24, C.text, 720);
  s += pill(1650, 130, '+184  −23', '#17221e', C.green);
  s += line(386, 162, 1852, 162, C.line);
  s += rect(396, 190, 930, 802, '#0e1213', 16, 1, C.line);
  s += rect(1346, 190, 486, 802, '#0e1213', 16, 1, C.line);
  s += text(426, 228, 'app/pricing/page.tsx', 15, C.muted, 650, 1, 'start', true);
  s += pill(1160, 228, 'modified', '#24211b', C.amber);
  s += line(396, 250, 1326, 250, C.line);
  const rows: Array<[string,string,'add'|'del'|'ctx']> = [
    ['38', 'const [billing, setBilling] = useState("monthly")', 'ctx'],
    ['39', 'const yearly = billing === "annual"', 'add'],
    ['40', 'const price = yearly ? plan.yearly : plan.monthly', 'add'],
    ['41', '', 'ctx'],
    ['42', '<PricingToggle value={billing}', 'add'],
    ['43', '  onChange={setBilling} />', 'add'],
    ['44', '<PlanGrid plans={plans} billing={billing} />', 'add'],
    ['45', '', 'ctx'],
    ['46', '<LegacyPricingTable />', 'del'],
  ];
  rows.forEach((r, i) => {
    const a = enter(f, 12 + i * 5, 5);
    s += codeRow(410, 298 + i * 48, r[0], r[1], r[2], a);
  });
  s += text(1378, 230, 'Terminal', 15, C.muted, 650);
  s += line(1346, 250, 1832, 250, C.line);
  const terminal = [
    ['$', 'npm test -- pricing'],
    ['✓', 'pricing toggle updates totals'],
    ['✓', 'mobile cards stack correctly'],
    ['✓', 'CTA preserves selected plan'],
    ['✓', 'a11y smoke checks'],
    ['', '4 passed  ·  1.8s'],
  ];
  terminal.forEach((row, i) => {
    const at = 64 + i * 12;
    const a = enter(f, at, 6);
    const y = 306 + i * 48;
    s += text(1376, y, row[0], 15, row[0] === '✓' ? C.green : C.faint, 700, a, 'start', true);
    s += text(1406, y, row[1], 14, row[0] === '✓' ? '#ccebdc' : C.muted, 500, a, 'start', true);
  });
  const passA = enter(f, 132, 7);
  s += pill(1378, 692, 'All checks passed', '#17221e', C.green, passA);
  s += sceneFlash(f);
  return svg(s);
}

function browserChrome(x: number, y: number, w: number, h: number, a = 1): string {
  let s = rect(x, y, w, h, '#f6f7f6', 18, a, '#2a3033');
  s += rect(x, y, w, 54, '#171b1d', 18, a);
  s += rect(x, y + 30, w, 24, '#171b1d', 0, a);
  s += circle(x + 26, y + 26, 5, '#ff605c', a) + circle(x + 44, y + 26, 5, '#ffbd44', a) + circle(x + 62, y + 26, 5, '#00ca4e', a);
  s += rect(x + 120, y + 14, w - 240, 28, '#23282a', 9, a);
  s += text(x + 140, y + 34, 'localhost:3000/pricing', 12, '#aab2af', 500, a, 'start', true);
  return s;
}
function sceneBrowser(f: number): string {
  let s = rect(0, 0, WIDTH, HEIGHT, C.bg) + appShell('Ship pricing page', 'flickstack');
  s += text(398, 130, 'Verify in the browser', 24, C.text, 720);
  s += text(650, 130, 'Codex can inspect, interact, and iterate.', 15, C.muted, 500);
  s += line(386, 162, 1852, 162, C.line);
  const a = enter(f, 6, 10);
  s += browserChrome(404, 194, 1418, 758, a);
  s += text(520, 334, 'Simple pricing.', 56, '#111314', 760, a);
  s += text(520, 380, 'Built for teams that ship.', 24, '#646b68', 500, a);
  const annual = f > 58;
  s += rect(1388, 310, 240, 44, '#ecefed', 22, a);
  s += rect(annual ? 1502 : 1394, 316, 120, 32, '#15191a', 16, a);
  s += text(1450, 338, 'Monthly', 13, annual ? '#707774' : '#ffffff', 650, a, 'middle');
  s += text(1562, 338, 'Annual', 13, annual ? '#ffffff' : '#707774', 650, a, 'middle');
  const cards = [
    ['Starter', '$19', 'For small teams'], ['Pro', annual ? '$49' : '$59', 'For shipping faster'], ['Scale', 'Talk to us', 'For larger orgs']
  ];
  cards.forEach((c, i) => {
    const x = 520 + i * 358;
    s += rect(x, 470, 318, 330, i === 1 ? '#111414' : '#ffffff', 18, a, i === 1 ? '#111414' : '#d9dddb');
    s += text(x + 28, 520, c[0], 19, i === 1 ? '#ffffff' : '#242827', 700, a);
    s += text(x + 28, 594, c[1], 38, i === 1 ? '#ffffff' : '#111414', 750, a);
    s += text(x + 28, 634, c[2], 14, i === 1 ? '#c6ceca' : '#6f7673', 500, a);
    s += rect(x + 28, 724, 262, 42, i === 1 ? '#ffffff' : '#111414', 10, a);
    s += text(x + 159, 751, i === 1 ? 'Start Pro' : 'Choose plan', 14, i === 1 ? '#111414' : '#ffffff', 700, a, 'middle');
  });
  const move = ease((f - 38) / 24);
  const cx = lerp(1650, 1544, move), cy = lerp(848, 334, move);
  s += cursor(cx, cy, a);
  if (f > 92) {
    const noteA = enter(f, 92, 7);
    s += rect(1240, 814, 496, 94, '#15191a', 14, noteA);
    s += text(1270, 848, 'Visual check', 13, C.green, 700, noteA);
    s += text(1270, 880, 'Spacing and responsive state match.', 15, C.text, 520, noteA);
  }
  s += sceneFlash(f);
  return svg(s);
}

function sceneComputer(f: number): string {
  let s = rect(0, 0, WIDTH, HEIGHT, C.bg) + appShell('Ship pricing page', 'flickstack');
  s += text(398, 130, 'Use the computer when the workflow needs it', 24, C.text, 720);
  s += line(386, 162, 1852, 162, C.line);
  const a = enter(f, 6, 10);
  s += rect(404, 194, 1418, 758, '#101415', 18, a, C.line);
  s += text(440, 236, 'Background computer use', 17, C.text, 700, a);
  s += pill(1604, 236, 'active', '#17221e', C.green, a);
  s += rect(440, 274, 850, 620, '#f4f5f4', 16, a);
  s += rect(464, 302, 802, 62, '#191d1f', 12, a);
  s += text(490, 341, 'Preview • localhost:3000/pricing', 14, '#c5ccca', 520, a, 'start', true);
  s += text(494, 430, 'Pro plan', 28, '#171a19', 750, a);
  s += text(494, 468, 'Annual billing saves 17%', 16, '#707774', 520, a);
  s += rect(494, 512, 320, 160, '#ffffff', 14, a, '#d6dad8');
  s += text(520, 554, 'Annual', 15, '#717875', 650, a);
  s += text(520, 610, '$49 / month', 28, '#111414', 780, a);
  s += rect(520, 626, 240, 36, '#111414', 9, a);
  s += text(640, 650, 'Start Pro', 13, '#ffffff', 700, a, 'middle');
  s += rect(1324, 274, 458, 620, '#0d1112', 16, a, C.line);
  s += sectionHeader(1354, 320, 'Codex', 'Observing the live page', a);
  const msgs = [
    ['Saw the pricing toggle update.', 38],
    ['The selected card shifts 4px on mobile.', 68],
    ['I’ll tighten the responsive spacing.', 96],
    ['Rechecking… fixed.', 124],
  ] as const;
  msgs.forEach(([m, at], i) => {
    const ma = enter(f, at, 6);
    s += rect(1354, 370 + i * 104, 392, 76, i === 3 ? '#17221e' : '#15191a', 12, ma);
    s += text(1376, 404 + i * 104, m, 14, i === 3 ? '#c9f9e1' : C.text, 520, ma);
  });
  const move = ease((f - 34) / 52);
  const cx = lerp(1130, 716, move), cy = lerp(786, 644, move);
  s += cursor(cx, cy, a);
  s += sceneFlash(f);
  return svg(s);
}

function sceneReview(f: number): string {
  let s = rect(0, 0, WIDTH, HEIGHT, C.bg) + appShell('Review PR #128', 'flickstack');
  s += text(398, 130, 'Review the result, not a black box', 24, C.text, 720);
  s += line(386, 162, 1852, 162, C.line);
  const a = enter(f, 6, 10);
  s += rect(404, 194, 1418, 758, '#0e1213', 18, a, C.line);
  s += text(440, 240, 'PR #128  •  Pricing page', 18, C.text, 700, a);
  s += pill(1570, 240, 'Ready to merge', '#17221e', C.green, a);
  s += line(404, 266, 1822, 266, C.line);
  const stats = [['4', 'files'], ['184', 'additions'], ['23', 'deletions'], ['4/4', 'checks']];
  stats.forEach((st, i) => {
    const x = 452 + i * 210;
    s += text(x, 330, st[0], 26, i === 3 ? C.green : C.text, 760, a);
    s += text(x, 356, st[1], 13, C.muted, 520, a);
  });
  s += rect(440, 404, 910, 474, '#111516', 14, a, C.line);
  s += text(468, 444, 'Files changed', 15, C.muted, 650, a);
  const files = [
    ['app/pricing/page.tsx', '+82', '−11'],
    ['components/pricing-grid.tsx', '+61', '−8'],
    ['components/pricing-toggle.tsx', '+29', '−4'],
    ['tests/pricing.spec.ts', '+12', '−0'],
  ];
  files.forEach((row, i) => {
    const y = 504 + i * 76;
    const fa = enter(f, 20 + i * 10, 7);
    s += circle(474, y - 8, 5, C.green, fa);
    s += text(492, y, row[0], 15, C.text, 560, fa, 'start', true);
    s += text(1238, y, row[1], 14, C.green, 650, fa, 'end', true);
    s += text(1308, y, row[2], 14, C.red, 650, fa, 'end', true);
    s += line(468, y + 24, 1322, y + 24, '#202628', 1, fa);
  });
  s += rect(1380, 404, 402, 474, '#111516', 14, a, C.line);
  s += text(1410, 444, 'Checks', 15, C.muted, 650, a);
  const checks = ['Unit tests', 'Visual verification', 'Typecheck', 'Lint'];
  checks.forEach((label, i) => {
    const ca = enter(f, 70 + i * 14, 7);
    const y = 510 + i * 76;
    s += circle(1418, y - 7, 12, C.green2, ca);
    s += text(1418, y - 3, '✓', 12, '#c9f9e1', 800, ca, 'middle');
    s += text(1444, y, label, 15, C.text, 560, ca);
  });
  if (f > 132) {
    const ma = enter(f, 132, 9);
    s += rect(1420, 770, 300, 46, '#e9ecea', 11, ma);
    s += text(1570, 800, 'Merge', 15, '#101313', 750, ma, 'middle');
    s += cursor(1685, 790, ma);
  }
  s += sceneFlash(f);
  return svg(s);
}

function sceneMontage(f: number): string {
  const slice = Math.min(4, Math.floor(f / 30));
  let s = rect(0, 0, WIDTH, HEIGHT, C.bg);
  const a = enter(f % 30, 0, 4);
  const titles = ['Threads in parallel', 'Files + terminals', 'Remote devbox', 'Task queue', 'One place to ship'];
  s += text(160, 150, titles[slice], 44, C.text, 760, a);
  s += text(160, 194, ['Work without blocking yourself.', 'Inspect the exact evidence.', 'Keep the same thread over SSH.', 'Turn work into a lightweight backlog.', 'Prompt → plan → code → verify.'][slice], 19, C.muted, 500, a);
  if (slice === 0) {
    for (let i = 0; i < 3; i++) {
      const x = 160 + i * 535;
      s += rect(x, 280, 470, 520, C.panel2, 18, a, C.line);
      s += pill(x + 28, 326, ['agent-1','agent-2','agent-3'][i], i === 2 ? '#17221e' : '#24211b', i === 2 ? C.green : C.amber, a);
      s += text(x + 28, 390, ['Layout', 'Tests', 'Review'][i], 25, C.text, 700, a);
      s += text(x + 28, 438, ['Editing components…', 'Running checks…', 'Ready.'][i], 16, C.muted, 520, a);
      s += rect(x + 28, 500, 414, 7, '#282e30', 4, a);
      s += rect(x + 28, 500, 414 * [0.72, 0.56, 1][i], 7, i === 2 ? C.green : C.amber, 4, a);
    }
  } else if (slice === 1) {
    s += rect(160, 280, 780, 520, '#0f1314', 18, a, C.line) + rect(980, 280, 780, 520, '#0f1314', 18, a, C.line);
    s += text(194, 326, 'Files', 16, C.muted, 650, a) + text(1014, 326, 'Terminal', 16, C.muted, 650, a);
    ['page.tsx','pricing-grid.tsx','pricing.spec.ts'].forEach((v,i)=>{ s += text(204, 402+i*60, v, 17, C.text, 560, a, 'start', true); });
    ['$ npm test','✓ 4 passed','✓ build clean'].forEach((v,i)=>{ s += text(1018, 402+i*60, v, 17, i ? C.green : C.text, 560, a, 'start', true); });
  } else if (slice === 2) {
    s += rect(160, 280, 1600, 520, '#0e1213', 18, a, C.line);
    s += text(198, 330, 'SSH  •  gpu-dev-07', 16, C.muted, 650, a, 'start', true);
    s += text(198, 410, '$ codex resume pricing-page', 21, C.text, 550, a, 'start', true);
    s += text(198, 472, 'Resumed thread with 14 prior turns', 17, C.green, 600, a, 'start', true);
    s += text(198, 534, 'Working tree clean. Tests passed.', 17, C.muted, 500, a, 'start', true);
  } else if (slice === 3) {
    s += rect(160, 280, 1600, 520, '#0f1314', 18, a, C.line);
    ['Polish pricing mobile','Review analytics PR','Fix flaky renderer test','Update docs screenshots'].forEach((v,i)=>{
      const y=358+i*96; s += circle(202,y-8,10,i===0?C.green2:'#252b2d',a); s += text(230,y,v,20,C.text,600,a); s += pill(1450,y,['done','queued','queued','queued'][i],i===0?'#17221e':'#1d2224',i===0?C.green:C.muted,a);
    });
  } else {
    s += text(160, 420, 'Prompt', 66, C.muted, 650, a);
    s += text(478, 420, '→', 66, C.faint, 500, a);
    s += text(610, 420, 'Plan', 66, C.text, 740, a);
    s += text(882, 420, '→', 66, C.faint, 500, a);
    s += text(1015, 420, 'Code', 66, C.text, 740, a);
    s += text(1295, 420, '→', 66, C.faint, 500, a);
    s += text(1428, 420, 'Verify', 66, C.green, 740, a);
    s += text(160, 560, 'The loop stays visible the whole way.', 28, C.muted, 520, a);
  }
  s += sceneFlash(f);
  return svg(s);
}

function sceneEnd(f: number): string {
  const a = enter(f, 0, 10);
  const a2 = enter(f, 18, 10);
  const a3 = enter(f, 38, 10);
  const tail = f > 76 ? exit(f, 76, 13) : 1;
  let s = rect(0, 0, WIDTH, HEIGHT, C.bg);
  s += circle(960, 430, 280, '#1f2a27', 0.13 * a * tail);
  s += text(960, 390, 'CODEX', 20, C.muted, 780, a * tail, 'middle', false, 5.5);
  s += text(960, 510, 'From prompt.', 72, C.text, 660, a2 * tail, 'middle');
  s += text(960, 600, 'To shipped code.', 92, C.text, 780, a3 * tail, 'middle');
  s += line(820, 656, 1100, 656, C.green, 6, a3 * tail);
  s += text(960, 728, 'openai codex', 18, C.muted, 600, a3 * tail, 'middle', true);
  s += sceneFlash(f);
  return svg(s);
}

function renderScene(id: typeof scenes[number]['id'], f: number): string {
  switch (id) {
    case 'hook': return sceneHook(f);
    case 'prompt': return scenePrompt(f);
    case 'parallel': return sceneParallel(f);
    case 'diff': return sceneDiff(f);
    case 'browser': return sceneBrowser(f);
    case 'computer': return sceneComputer(f);
    case 'review': return sceneReview(f);
    case 'montage': return sceneMontage(f);
    case 'end': return sceneEnd(f);
  }
}

function run(command: string, args: string[], cwd = ROOT): void {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe', timeout: 300_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})\n${result.stderr?.slice(-8000)}`);
}

function encodeScene(scene: typeof scenes[number]): string {
  const frameDir = join(WORK, `frames-${scene.id}`);
  const output = join(WORK, `${scene.id}.mp4`);
  rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });
  for (let f = 0; f < scene.duration; f++) {
    writeFileSync(join(frameDir, `frame-${String(f).padStart(6, '0')}.svg`), renderScene(scene.id, f));
  }
  run('ffmpeg', ['-y', '-framerate', String(FPS), '-start_number', '0', '-i', join(frameDir, 'frame-%06d.svg'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output]);
  rmSync(frameDir, { recursive: true, force: true });
  return output;
}

function wavHeader(dataBytes: number, sampleRate: number, channels: number): Buffer {
  const b = Buffer.alloc(44);
  b.write('RIFF', 0); b.writeUInt32LE(36 + dataBytes, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(sampleRate, 24); b.writeUInt32LE(sampleRate * channels * 2, 28); b.writeUInt16LE(channels * 2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(dataBytes, 40); return b;
}
function synthesizeSoundtrack(path: string): void {
  const sampleRate = 48_000, channels = 2, count = Math.round(TOTAL_SECONDS * sampleRate);
  const pcm = Buffer.alloc(count * channels * 2); let seed = 0x6d2b79f5;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0xffffffff * 2 - 1; };
  const sceneHits = [2, 7, 13, 18, 23, 28, 34, 39];
  const clicks = [6.1, 16.4, 22.2, 27.2, 33.4, 37.4];
  for (let i = 0; i < count; i++) {
    const t = i / sampleRate;
    const beatIndex = Math.floor(t / 0.5), beatDt = t - beatIndex * 0.5;
    const eighthIndex = Math.floor(t / 0.25), eighthDt = t - eighthIndex * 0.25;
    let v = 0.018 * Math.sin(2 * Math.PI * 55 * t) + 0.012 * Math.sin(2 * Math.PI * 82.41 * t) + 0.009 * Math.sin(2 * Math.PI * 110 * t);
    if (beatDt < 0.18) {
      const env = Math.exp(-18 * beatDt); const freq = 58 + 54 * Math.exp(-28 * beatDt);
      v += 0.22 * env * Math.sin(2 * Math.PI * freq * beatDt);
    }
    if ((beatIndex % 4 === 1 || beatIndex % 4 === 3) && beatDt < 0.10) v += 0.08 * rnd() * Math.exp(-34 * beatDt);
    if (eighthDt < 0.035) v += 0.028 * rnd() * Math.exp(-95 * eighthDt) * (eighthIndex % 2 ? 1 : 0.7);
    for (const hit of sceneHits) {
      const d = t - hit;
      if (d >= 0 && d < 0.24) v += 0.12 * Math.exp(-16 * d) * Math.sin(2 * Math.PI * (160 - 80 * d) * d);
      const pre = hit - t;
      if (pre > 0 && pre < 0.35) v += 0.018 * rnd() * (1 - pre / 0.35);
    }
    for (const click of clicks) {
      const d = t - click;
      if (d >= 0 && d < 0.045) v += 0.11 * Math.sin(2 * Math.PI * 1480 * d) * Math.exp(-72 * d);
    }
    // Pull the bed down slightly under the end card.
    const endDuck = t > 39 ? 1 - 0.45 * clamp((t - 39) / 3) : 1;
    v *= endDuck;
    const pan = 0.05 * Math.sin(2 * Math.PI * 0.11 * t);
    const left = clamp(v * (1 - pan), -0.92, 0.92);
    const right = clamp(v * (1 + pan), -0.92, 0.92);
    pcm.writeInt16LE(Math.round(left * 32767), i * 4);
    pcm.writeInt16LE(Math.round(right * 32767), i * 4 + 2);
  }
  writeFileSync(path, Buffer.concat([wavHeader(pcm.length, sampleRate, channels), pcm]));
}

function buildProject(): FlickProject {
  let cursorFrame = 0;
  const assets = scenes.map(scene => ({ id: `scene-${scene.id}`, path: `examples/codex-promo/work/${scene.id}.mp4`, kind: 'video' as const, duration: scene.duration }));
  const clips = scenes.map(scene => {
    const clip = { id: `clip-${scene.id}`, assetId: `scene-${scene.id}`, start: cursorFrame, duration: scene.duration, sourceIn: 0 };
    cursorFrame += scene.duration;
    return clip;
  });
  const markers = [] as FlickProject['markers'];
  let markerAt = 0;
  for (const scene of scenes) { markers.push({ id: `marker-${scene.id}`, at: markerAt, label: scene.label }); markerAt += scene.duration; }
  const now = new Date().toISOString();
  return {
    version: 1,
    id: 'codex-usage-promo-42s',
    name: 'Codex Usage Promo — 42s',
    format: { width: WIDTH, height: HEIGHT, fps: { numerator: FPS, denominator: 1 }, audioSampleRate: 48_000 },
    assets: [...assets, { id: 'soundtrack', path: 'examples/codex-promo/work/soundtrack.wav', kind: 'audio', duration: TOTAL_FRAMES }],
    tracks: [
      { id: 'v1', kind: 'video', name: 'Codex UI scenes', clips },
      { id: 'a1', kind: 'audio', name: 'Original 120 BPM score + UI sound design', clips: [{ id: 'clip-audio', assetId: 'soundtrack', start: 0, duration: TOTAL_FRAMES, sourceIn: 0, volume: 0.9 }] },
      { id: 'm1', kind: 'motion', name: 'Motion', clips: [] },
      { id: 'c1', kind: 'caption', name: 'Captions', clips: [] },
    ],
    markers,
    style: {
      creativeSystem: 'product-led developer launch film',
      bpm: BPM,
      beatFrames: BEAT,
      palette: C,
      pacing: 'hard cuts on beat, short precision punch-ins, varied holds',
      evidencePolicy: 'original vector recreation of documented Codex workflows; no stock footage or synthetic people',
      narrative: ['prompt', 'parallel work', 'diff', 'tests', 'browser verification', 'computer use', 'PR review', 'ship'],
    },
    provenance: [
      ...scenes.map(scene => ({ assetId: `scene-${scene.id}`, provider: 'FlickSmith original vector production', creator: 'Codex promo generator', sourceUrl: 'https://developers.openai.com/codex/app', license: 'original composition', commercialAllowed: true, attributionRequired: false, retrievedAt: now })),
      { assetId: 'soundtrack', provider: 'FlickSmith procedural audio', creator: 'Codex promo generator', license: 'original composition', commercialAllowed: true, attributionRequired: false, retrievedAt: now },
    ],
    checkpoints: [{ id: 'cp-codex-promo-v1', createdAt: now, label: 'Codex promo edit v1', branch: 'promo/codex-usage-v1', intent: 'Professional beat-synced Codex usage ad grounded in authentic workflow.' }],
    branches: [{ name: 'promo/codex-usage-v1', checkpointId: 'cp-codex-promo-v1' }],
    semanticLocks: [{ id: 'lock-end', label: 'Keep To shipped code end card at close', rule: 'position', trackId: 'v1', clipId: 'clip-end', start: TOTAL_FRAMES - scenes.at(-1)!.duration, end: TOTAL_FRAMES }],
  };
}

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
mkdirSync(OUT, { recursive: true });
for (const scene of scenes) {
  console.log(`Rendering scene ${scene.id} (${scene.duration} frames)`);
  encodeScene(scene);
}
console.log('Synthesizing original soundtrack');
synthesizeSoundtrack(join(WORK, 'soundtrack.wav'));
const project = buildProject();
writeFileSync(join(DIR, 'project.flick.json'), serializeProject(project));
writeFileSync(join(OUT, 'render-manifest.json'), JSON.stringify({ width: WIDTH, height: HEIGHT, fps: FPS, bpm: BPM, totalFrames: TOTAL_FRAMES, durationSeconds: TOTAL_SECONDS, scenes }, null, 2) + '\n');
console.log(`Prepared ${project.name}: ${TOTAL_FRAMES} frames / ${TOTAL_SECONDS}s`);
