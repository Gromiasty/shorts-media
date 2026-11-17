// Szybki render Shorta (wzorzec: lemo-opuscar core/render/video.mjs, MIT).
// node tools/render_fast.mjs render.html --out out/film.mp4 [--fps 30] [--workers 2] [--q render] [--size 1080x1920] [--from 0 --to DUR] [--png frames/]
// Każdy proces ma własną przeglądarkę; klatki JPEG q95 idą rurą prosto do ffmpeg (bez PNG na dysku), segmenty łączone bez rekompresji.
// Strona musi wystawiać window.renderAt(t), window.DUR i window.READY (nasz kontrakt).
import fs from 'fs'; import path from 'path'; import { spawn, execFileSync } from 'child_process'; import { pathToFileURL } from 'url';
import { chromium } from 'playwright-core';
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const page0 = path.resolve(A[0]); const out = path.resolve(opt('--out', 'out/film.mp4'));
const FPS = +opt('--fps', 30), WK = +opt('--workers', 2), Q = opt('--q', 'render'), [W, H] = opt('--size', '1080x1920').split('x').map(Number);
const PNG = opt('--png', null), QUAL = +opt('--quality', 95), CRF = opt('--crf', '14');
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--font-render-hinting=none', '--force-color-profile=srgb', '--allow-file-access-from-files'];
fs.mkdirSync(path.dirname(out), { recursive: true });
const seg = fs.mkdtempSync(path.join(path.dirname(out), '.segs-'));
async function open() {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ARGS });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  p.on('pageerror', e => { console.error('[pageerror]', e.message); process.exit(1); });
  await p.goto(pathToFileURL(page0).href + '?' + Q);
  await p.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
  return { b, p };
}
const t0 = Date.now();
const probe = await open(); const DUR = await probe.p.evaluate(() => window.DUR); await probe.b.close();
const F0 = Math.round(+opt('--from', 0) * FPS), F1 = Math.round(+opt('--to', DUR) * FPS), N = F1 - F0, per = Math.ceil(N / WK);
await Promise.all([...Array(WK)].map(async (_, w) => {
  const a = F0 + w * per, b = Math.min(F1, a + per); if (a >= b) return;
  const { b: br, p } = await open();
  const ff = PNG ? null : spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', CRF, '-pix_fmt', 'yuv420p', `seg_${w}.mp4`], { cwd: seg, stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = ff ? new Promise(r => ff.on('close', r)) : null;
  for (let f = a; f < b; f++) {
    await p.evaluate(t => window.renderAt(t), f / FPS);
    if (PNG) { fs.mkdirSync(PNG, { recursive: true }); await p.screenshot({ type: 'png', path: path.join(PNG, `f${String(f).padStart(5, '0')}.png`) }); continue; }
    const buf = await p.screenshot({ type: 'jpeg', quality: QUAL });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - a) % 60 === 0) console.log(`w${w} ${f - a}/${b - a} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  if (ff) { ff.stdin.end(); const c = await closed; if (c !== 0) { console.error('ffmpeg failed', w); process.exit(1); } }
  await br.close();
}));
if (!PNG) {
  fs.writeFileSync(path.join(seg, 'l.txt'), [...Array(WK)].map((_, w) => w).filter(w => F0 + w * per < F1).map(w => `file 'seg_${w}.mp4'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'l.txt', '-c', 'copy', 'm.mp4'], { cwd: seg });
  fs.renameSync(path.join(seg, 'm.mp4'), out);
}
fs.rmSync(seg, { recursive: true, force: true });
const s = (Date.now() - t0) / 1000; console.log(`done ${N} klatek w ${s.toFixed(0)} s = ${(N / s * 60).toFixed(0)} klatek/min -> ${PNG || out}`);
