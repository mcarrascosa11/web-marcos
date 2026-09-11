import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve('public');
const extensions = /\.(jpe?g|png|webp)$/i;
const MAX_WIDTH = 2200;

function filesIn(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...filesIn(file));
    else if (extensions.test(entry.name)) result.push(file);
  }
  return result;
}

for (const file of filesIn(ROOT)) {
  const stat = fs.statSync(file);
  if (stat.size < 350 * 1024) continue;
  const ext = path.extname(file).toLowerCase();
  const tmp = `${file}.tmp`;
  const image = sharp(file).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true });
  if (ext === '.webp') await image.webp({ quality: 82, effort: 4 }).toFile(tmp);
  else if (ext === '.png') await image.png({ compressionLevel: 9, palette: false }).toFile(tmp);
  else await image.jpeg({ quality: 82, mozjpeg: true }).toFile(tmp);

  const newSize = fs.statSync(tmp).size;
  if (newSize < stat.size) {
    fs.renameSync(tmp, file);
    console.log(`Optimizada: ${path.relative(ROOT, file)} (${Math.round(stat.size / 1024)} KB -> ${Math.round(newSize / 1024)} KB)`);
  } else {
    fs.unlinkSync(tmp);
  }
}
