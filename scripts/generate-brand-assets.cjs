/**
 * Regenerates Orbit's raster brand assets from the logo artwork (the same
 * drawing as public/favicon.svg): app icons, the extension's icons and the
 * 1200x630 social preview card. Run after changing the logo:
 *
 *   node scripts/generate-brand-assets.cjs
 *
 * Needs Playwright with Chromium (preinstalled in Claude Code cloud sessions;
 * locally: npm i -D playwright && npx playwright install chromium).
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const ICONS = path.join(ROOT, "extension", "icons");
const logo = (rx, inset = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-inset} ${-inset} ${64 + 2 * inset} ${64 + 2 * inset}"><rect x="${-inset}" y="${-inset}" width="${64 + 2 * inset}" height="${64 + 2 * inset}" rx="${rx}" fill="#7961db"/><g fill="none" stroke="#fff" stroke-width="4"><ellipse cx="32" cy="32" rx="22" ry="12" transform="rotate(-38 32 32)"/><circle cx="32" cy="32" r="8"/></g><circle cx="48" cy="19" r="5" fill="#e3dcff"/></svg>`;
const font = (pkg, file) => `data:font/woff2;base64,${fs.readFileSync(`${ROOT}/node_modules/@fontsource-variable/${pkg}/files/${file}`).toString("base64")}`;
(async () => {
  const b = await chromium.launch();
  const render = async (svg, size, name) => {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await p.screenshot({ path: name, omitBackground: true });
    await p.close();
  };
  for (const s of [16, 32, 48, 128]) await render(logo(18), s, `${ICONS}/icon-${s}.png`);
  await render(logo(18), 192, `${PUBLIC}/icon-192.png`);
  await render(logo(18), 512, `${PUBLIC}/icon-512.png`);
  await render(logo(0, 8), 512, `${PUBLIC}/icon-maskable-512.png`); // full bleed; artwork inside the 80% safe zone
  await render(logo(0, 4), 180, `${PUBLIC}/apple-touch-icon.png`); // iOS rounds the corners itself
  // Social preview card, set in the site's own typefaces.
  const files = fs.readdirSync(`${ROOT}/node_modules/@fontsource-variable/manrope/files`).filter((f) => /latin-wght-normal/.test(f) && !/ext/.test(f));
  const dm = fs.readdirSync(`${ROOT}/node_modules/@fontsource-variable/dm-sans/files`).filter((f) => /latin-wght-normal/.test(f) && !/ext/.test(f));
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(`<style>
    @font-face { font-family: Manrope; src: url(${font("manrope", files[0])}); font-weight: 200 800; }
    @font-face { font-family: DMSans; src: url(${font("dm-sans", dm[0])}); font-weight: 100 1000; }
    html,body{margin:0}
    .card{width:1200px;height:630px;box-sizing:border-box;padding:76px 84px;position:relative;overflow:hidden;font-family:DMSans;color:#33323f;
      background: radial-gradient(90% 120% at 100% 0%, #e9e1fb 0%, rgba(233,225,251,0) 60%), radial-gradient(70% 90% at 0% 100%, #fbefe7 0%, rgba(251,239,231,0) 60%), #f8f9fb;}
    .brand{display:flex;align-items:center;gap:18px;font-family:Manrope;font-weight:800;font-size:44px;letter-spacing:-2px}
    .brand svg{width:64px;height:64px}
    .brand b{color:#8062d2}
    h1{font-family:Manrope;font-weight:750;font-size:78px;letter-spacing:-3.2px;line-height:1.05;margin:58px 0 22px;max-width:760px}
    p{font-size:28px;line-height:1.45;color:#5c5669;margin:0;max-width:640px}
    .pill{display:inline-flex;gap:10px;align-items:center;margin-top:34px;padding:12px 18px;border-radius:999px;background:#fff;border:1px solid #e6dff6;font-size:21px;color:#5a4d70}
    .pill i{width:10px;height:10px;border-radius:50%;background:#7fae96}
    .chart{position:absolute;right:-10px;bottom:0;width:540px;height:300px;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 30%);mask-image:linear-gradient(90deg,transparent 0,#000 30%)}
  </style><div class="card">
    <div class="brand">${logo(18)}<span>orbit<b>.</b></span></div>
    <h1>Your AI, in perspective.</h1>
    <p>A private dashboard for your AI time, observed sends and costs.</p>
    <div class="pill"><i></i> No account · no server · saved in your browser</div>
    <svg class="chart" viewBox="0 0 520 290" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8062d2" stop-opacity=".22"/><stop offset="1" stop-color="#8062d2" stop-opacity="0"/></linearGradient></defs>
      <path d="M0,210 C40,200 60,150 100,160 S160,220 200,170 S260,60 300,95 S360,190 400,140 S470,40 520,60 L520,290 L0,290 Z" fill="url(#g)"/>
      <path d="M0,210 C40,200 60,150 100,160 S160,220 200,170 S260,60 300,95 S360,190 400,140 S470,40 520,60" fill="none" stroke="#8062d2" stroke-width="6" stroke-linecap="round"/>
      <circle cx="300" cy="95" r="10" fill="#fff" stroke="#8062d2" stroke-width="5"/></svg>
  </div>`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${PUBLIC}/og-image.png` });
  await b.close();
  console.log("Brand assets written to public/ and extension/icons/.");
})().catch((e) => { console.error(e); process.exit(1); });
