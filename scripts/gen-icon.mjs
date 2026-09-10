// Generates app-icon.png (1024x1024): blue gradient rounded square + white emote face.
// Run: node scripts/gen-icon.mjs
import { PNG } from "pngjs";
import fs from "node:fs";

const S = 1024;
const SS = 2; // supersampling for smooth edges
const png = new PNG({ width: S, height: S });

const TOP = [10, 132, 255]; // #0A84FF
const BOT = [0, 83, 214];   // #0053D6

const half = S / 2;
const corner = 0.225 * S;

// Face geometry (fractions of S)
const eyeL = [0.375, 0.4], eyeR = [0.625, 0.4], eyeRr = 0.052;
const smileC = [0.5, 0.5], smileR = 0.175, smileT = 0.042;

function inRoundedRect(x, y) {
  const dx = Math.abs(x - half), dy = Math.abs(y - half);
  if (dx > half || dy > half) return false;
  const qx = dx - (half - corner), qy = dy - (half - corner);
  if (qx <= 0 || qy <= 0) return true;
  return qx * qx + qy * qy <= corner * corner;
}

function isFace(x, y) {
  const nx = x / S, ny = y / S;
  const dL = Math.hypot(nx - eyeL[0], ny - eyeL[1]);
  const dR = Math.hypot(nx - eyeR[0], ny - eyeR[1]);
  if (dL <= eyeRr || dR <= eyeRr) return true;
  const dS = Math.hypot(nx - smileC[0], ny - smileC[1]);
  const lower = ny > smileC[1] + smileR * 0.05;
  return lower && Math.abs(dS - smileR) <= smileT / 2;
}

for (let py = 0; py < S; py++) {
  for (let px = 0; px < S; px++) {
    let bg = 0, fg = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const x = px + (sx + 0.5) / SS, y = py + (sy + 0.5) / SS;
        if (!inRoundedRect(x, y)) continue;
        bg++;
        if (isFace(x, y)) fg++;
      }
    }
    const idx = (S * py + px) * 4;
    if (bg === 0) {
      png.data[idx + 3] = 0;
      continue;
    }
    const t = (px + py) / (2 * S);
    png.data[idx] = Math.round(TOP[0] + (BOT[0] - TOP[0]) * t);
    png.data[idx + 1] = Math.round(TOP[1] + (BOT[1] - TOP[1]) * t);
    png.data[idx + 2] = Math.round(TOP[2] + (BOT[2] - TOP[2]) * t);
    if (fg === SS * SS) {
      png.data[idx] = png.data[idx + 1] = png.data[idx + 2] = 255;
      png.data[idx + 3] = 255;
    } else if (fg === 0) {
      png.data[idx + 3] = Math.round((bg / (SS * SS)) * 255);
    } else {
      // anti-aliased face edge: blend toward white
      const f = fg / (SS * SS);
      png.data[idx] = Math.round(png.data[idx] + (255 - png.data[idx]) * f);
      png.data[idx + 1] = Math.round(png.data[idx + 1] + (255 - png.data[idx + 1]) * f);
      png.data[idx + 2] = Math.round(png.data[idx + 2] + (255 - png.data[idx + 2]) * f);
      png.data[idx + 3] = Math.round((bg / (SS * SS)) * 255);
    }
  }
}

png.pack().pipe(fs.createWriteStream("app-icon.png")).on("finish", () => {
  console.log("Wrote app-icon.png");
});
