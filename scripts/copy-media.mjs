// Copies the referenced scraped assets into committed public/media/**.
// Reads content/generated/assets.json (produced by gen-content.mjs) + a few
// explicit homepage assets, plus the logo and favicon.
//
// Run: node scripts/copy-media.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "scraped_content", "assets");
const PUBLIC = path.join(ROOT, "public");

function copy(from, to) {
  const src = path.join(ASSETS, from);
  const dest = path.join(PUBLIC, to);
  if (!fs.existsSync(src)) {
    console.warn("MISSING", from);
    return false;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

// 1) Referenced assets -> public/media/<same path>
const referenced = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, "content", "generated", "assets.json"),
    "utf8",
  ),
);
let n = 0;
for (const rel of referenced) if (copy(rel, path.join("media", rel))) n++;

// 2) Homepage hero + featured-service images (home isn't parsed as a content page)
//
// WARNING: the two hero entries are optimised in place after copying and the committed files no
// longer match the archive. The archive video is 6.1MB with an audio track on a muted element,
// and its poster is a fully black frame. Re-running this script restores both, so afterwards
// re-encode (H.264, 1280 wide, no audio, crf 28, +faststart) and re-extract the poster from
// ~7s in. `/media/**` is served `immutable`, so any replacement needs a new filename.
const extras = {
  "files/land/77/82460fab8e90cc313397000b54d0d51e.mp4": "media/hero.mp4",
  "files/land/77/32aab255f5c1e554703f8adfec990f79.jpg": "media/hero-poster.jpg",
  "files/land/78/d31d7097df422f876c67c0431b82faad.jpg":
    "media/home/endospheres.jpg",
  "files/land/78/d2d5d9bdcae3b92882c32941b469903e.jpg": "media/home/arosha.jpg",
  "files/land/78/bd7697985615481212167cc81f101683.jpg": "media/home/facial.jpg",
  "files/land/78/09456e2d273094879f93f51d60f2ac6c.jpg": "media/home/about.jpg",
};
for (const [from, to] of Object.entries(extras)) if (copy(from, to)) n++;

// 3) Logo -> public/logo.svg ; favicon -> app/favicon.ico
copy("i/logo.svg", "logo.svg");
{
  const favSrc = path.join(ASSETS, "favicon.ico");
  const favDest = path.join(ROOT, "app", "favicon.ico");
  if (fs.existsSync(favSrc)) fs.copyFileSync(favSrc, favDest);
}

console.log(`copied ${n} media files + logo + favicon`);
