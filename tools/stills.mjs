// Klatki kontrolne: node tools/stills.mjs <page.html> <outdir> <q> t1 t2 ...  (q np. "render" albo "render&post=0")
// Wzorzec: lemo-opuscar core/render/still.mjs. Kończy się błędem, gdy strona rzuci wyjątek.
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url'; import { chromium } from 'playwright-core';
const [page0, out, q, ...ts] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--force-color-profile=srgb'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
let err = null; p.on('pageerror', e => { err = e.message; }); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.error('[page]', m.text().slice(0, 200)); });
await p.goto(pathToFileURL(path.resolve(page0)).href + '?' + q);
await p.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
for (const t of ts) {
  const t0 = Date.now(); await p.evaluate(t => window.renderAt(t), +t);
  await p.screenshot({ type: 'jpeg', quality: 92, path: path.join(out, `t${(+t).toFixed(2)}.jpg`) });
  console.log(t, Date.now() - t0, 'ms'); if (err) { console.error('[pageerror]', err); process.exit(1); }
}
await b.close();
