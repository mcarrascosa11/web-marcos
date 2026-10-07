// Generates responsive WebP variants (and Open Graph JPEGs) from the original photos.
// Files are read and written through Node buffers so long Windows paths work.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import sharp from 'sharp';

const PIPELINE_VERSION = 1; // bump to regenerate every cached variant
const PHOTO_WIDTHS = [480, 800, 1200, 1600, 2000, 2600];
const CACHE_DIR = path.join(process.cwd(), 'node_modules', '.cache', 'web-imagenes');

export function createImages(publicDir) {
  const queue = [];
  const pending = [];
  const limit = Math.max(2, os.cpus().length);
  let active = 0;
  let encoded = 0;
  let cached = 0;

  const run = () => {
    while (active < limit && queue.length) {
      const task = queue.shift();
      active++;
      task().finally(() => { active--; run(); });
    }
  };
  const schedule = fn => {
    const promise = new Promise((resolve, reject) => { queue.push(() => fn().then(resolve, reject)); run(); });
    pending.push(promise);
    return promise;
  };

  async function inspect(file) {
    const buffer = fs.readFileSync(file);
    const meta = await sharp(buffer).metadata();
    const rotated = (meta.orientation || 1) >= 5;
    return {
      buffer,
      width: rotated ? meta.height : meta.width,
      height: rotated ? meta.width : meta.height,
      hash: crypto.createHash('sha1').update(buffer).digest('hex')
    };
  }

  function emit(buffer, key, target, encode) {
    const out = path.join(publicDir, target);
    const cacheFile = path.join(CACHE_DIR, key);
    schedule(async () => {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      if (fs.existsSync(cacheFile)) { fs.copyFileSync(cacheFile, out); cached++; return; }
      const data = await encode(sharp(buffer).rotate()).toBuffer();
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(cacheFile, data);
      fs.writeFileSync(out, data);
      encoded++;
    });
  }

  // name: output path without extension, e.g. "proyectos/fp-tudela/01"
  async function responsive(file, name, { quality = 80, widths = PHOTO_WIDTHS } = {}) {
    const { buffer, width, height, hash } = await inspect(file);
    const id = crypto.createHash('sha1').update(`${hash}:${quality}:${PIPELINE_VERSION}`).digest('hex').slice(0, 10);
    const sizes = widths.filter(w => w < width);
    if (!sizes.length || sizes.at(-1) < Math.min(width, widths.at(-1))) sizes.push(Math.min(width, widths.at(-1)));
    const variants = sizes.map(w => {
      const target = `img/${name}-${w}.${id}.webp`;
      emit(buffer, `${id}-${w}.webp`, target, img => img.resize({ width: w }).webp({ quality, effort: 4 }));
      return { w, url: `/${target}` };
    });
    const fallback = variants.find(v => v.w >= 1200) || variants.at(-1);
    return {
      src: fallback.url,
      srcset: variants.map(v => `${v.url} ${v.w}w`).join(', '),
      width,
      height
    };
  }

  // 1200×630 JPEG for social previews (WhatsApp, LinkedIn, etc.)
  async function openGraph(file, name) {
    const { buffer, hash } = await inspect(file);
    const id = crypto.createHash('sha1').update(`${hash}:og:${PIPELINE_VERSION}`).digest('hex').slice(0, 10);
    const target = `img/og/${name}.${id}.jpg`;
    emit(buffer, `${id}-og.jpg`, target, img => img.resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 82, mozjpeg: true }));
    return { url: `/${target}`, width: 1200, height: 630 };
  }

  async function done() {
    await Promise.all(pending);
    return { encoded, cached };
  }

  return { responsive, openGraph, done };
}
