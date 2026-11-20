import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/Volumes/work disk/Codes/Tracker/AppFlowy-Web/package.json');
const { chromium } = require('playwright');
const S = process.argv[2]; const O = `${S}/out`;
const jobs = [];
const j = (src, dst, w, h, opaque) => jobs.push({ src: `${O}/${src}`, dst: `${O}/${dst}`, w, h, opaque });
// app icons (all sizes in the original manifest) from the master app-icon.svg
for (const n of [16, 32, 48, 64, 96, 120, 128, 144, 152, 167, 180, 192, 256, 512, 1024]) j('favicon/app-icon.svg', `png/workzen-app-icon-${n}.png`, n, n);
j('favicon/app-icon-dark.svg', 'png/workzen-app-icon-dark-512.png', 512, 512);
j('favicon/apple-touch-icon.svg', 'favicon/apple-touch-icon.png', 180, 180, true);
for (const n of [16, 32, 48]) j('favicon/favicon.svg', `favicon/favicon-${n}.png`, n, n);
for (const n of [16, 32, 48]) j('favicon/favicon-light.svg', `favicon/favicon-light-${n}.png`, n, n);
for (const n of [16, 32, 48]) j('favicon/favicon-dark.svg', `favicon/favicon-dark-${n}.png`, n, n);
j('favicon/favicon-light.svg', 'favicon/favicon-192.png', 192, 192);
j('favicon/favicon-light.svg', 'favicon/favicon-512.png', 512, 512);
// symbol exports (square canvas, transparent)
for (const [k, s] of [['symbol-transparent', 'svg/workzen-symbol.svg'], ['symbol-mono-transparent', 'svg/workzen-symbol-mono.svg'], ['symbol-white-transparent', 'svg/workzen-symbol-white.svg']]) j(s, `png/workzen-${k}.png`, 1024, 768);
j('svg/workzen-logo.svg', 'png/workzen-logo-preview.png', 1600, 405, true);
j('og/og-image.svg', 'og/og-image.png', 1200, 630, true);
j('og/og-image-dark.svg', 'og/og-image-dark.png', 1200, 630, true);

j('email/workzen-logo-email.svg', 'email/workzen-logo-email.png', 560, 109, false);
const b = await chromium.launch();
for (const job of jobs) {
  const svg = fs.readFileSync(job.src, 'utf8').replace(/<svg /, `<svg width="${job.w}" height="${job.h}" style="display:block" `);
  const p = await b.newPage({ viewport: { width: job.w, height: job.h }, deviceScaleFactor: 1 });
  await p.setContent(`<html><body style="margin:0;background:${job.opaque ? '#fff' : 'transparent'}">${svg}</body></html>`);
  await p.screenshot({ path: job.dst, omitBackground: !job.opaque });
  await p.close();
}
await b.close();
console.log(jobs.length, 'rasters');
