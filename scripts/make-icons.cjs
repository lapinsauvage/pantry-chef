// Regenerates the app icons and splash image from one SVG glyph (a cooking pot with steam).
//   node scripts/make-icons.cjs        (needs Playwright's Chromium: npx playwright install chromium)
// Writes assets/images/*.png and assets/expo.icon/Assets/pot.svg (iOS 26 Icon Composer layer;
// the orange background of that icon is the "fill" in assets/expo.icon/icon.json).
/* global __dirname */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const ORANGE_TOP = '#F2762E';
const ORANGE_BOTTOM = '#C2410C';

/** White (or `color`) pot glyph in a 1024 box, scaled around the centre. */
function glyph(color, scale = 1) {
  const steam = (x) =>
    `<path d="M ${x} 330 C ${x - 34} 300, ${x - 34} 262, ${x} 236 S ${x + 34} 172, ${x} 142" fill="none" stroke="${color}" stroke-width="34" stroke-linecap="round"/>`;
  return `<g transform="translate(512 512) scale(${scale}) translate(-512 -490)">
    ${steam(402)}${steam(512)}${steam(622)}
    <rect x="474" y="372" width="76" height="44" rx="18" fill="${color}"/>
    <rect x="226" y="404" width="572" height="62" rx="31" fill="${color}"/>
    <path d="M 270 492 H 754 V 690 C 754 760 706 808 636 808 H 388 C 318 808 270 760 270 690 Z" fill="${color}"/>
    <rect x="176" y="520" width="118" height="52" rx="26" fill="${color}"/>
    <rect x="730" y="520" width="118" height="52" rx="26" fill="${color}"/>
  </g>`;
}

const background = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ORANGE_TOP}"/><stop offset="1" stop-color="${ORANGE_BOTTOM}"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>`;
const svg = (body, size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${body}</svg>`;

const pngs = {
  'icon.png': [background + glyph('#FFFFFF', 0.78), 1024],
  'android-icon-foreground.png': [glyph('#FFFFFF', 0.58), 1024], // inside the adaptive icon's 66% safe zone
  'android-icon-background.png': [background, 1024],
  'android-icon-monochrome.png': [glyph('#000000', 0.58), 1024], // Android 13+ themed icons
  'splash-icon.png': [glyph('#FFFFFF', 1), 1024],
  'favicon.png': [background + glyph('#FFFFFF', 0.78), 48],
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, [body, size]] of Object.entries(pngs)) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(body, size)}</body></html>`);
    await page.screenshot({ path: path.join(ROOT, 'assets/images', name), omitBackground: true });
  }
  fs.writeFileSync(path.join(ROOT, 'assets/expo.icon/Assets/pot.svg'), svg(glyph('#FFFFFF', 0.62)));
  await browser.close();
  console.log('icons written');
})();
