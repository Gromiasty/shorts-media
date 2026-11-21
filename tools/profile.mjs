// Pomiar kosztu klatki: renderAt (+ wymuszenie GPU przez readPixels) vs zrzut PNG / JPEG.
// node tools/profile.mjs <page.html> <q> t1 t2 ...
import path from 'path'; import { pathToFileURL } from 'url'; import { chromium } from 'playwright-core';
const [page0, q, ...ts] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await p.goto(pathToFileURL(path.resolve(page0)).href + '?' + q);
await p.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
for (const t of ts) {
  const r = await p.evaluate(t => { const a = performance.now(); window.renderAt(t); const g = window.RR.getContext(); const px = new Uint8Array(4); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); return performance.now() - a; }, +t);
  let a = Date.now(); await p.screenshot({ type: 'png' }); const png = Date.now() - a;
  a = Date.now(); await p.screenshot({ type: 'jpeg', quality: 95 }); const jpg = Date.now() - a;
  console.log(`t=${t} render ${r.toFixed(0)} ms | png ${png} ms | jpeg ${jpg} ms`);
}
await b.close();
