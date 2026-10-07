// Imports original photos into a project folder at web-ready master quality.
// Usage: npm run preparar-fotos -- <carpeta-origen> <slug> [--portada foto.jpg] [--portada-movil foto.jpg] [--plano plano.png] [--anadir]
// Photos are numbered 01.jpg, 02.jpg... in file-name order; the build makes the smaller versions.
// --portada names one of those photos: it stays in the gallery, is kept at higher resolution and opens the project.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : null; };
const flag = name => { const i = args.indexOf(`--${name}`); if (i >= 0) args.splice(i, 1); return i >= 0; };
const portada = option('portada');
const portadaMovil = option('portada-movil');
const plano = option('plano');
const append = flag('anadir');
const [sourceDir, slug] = args;

if (!sourceDir || !slug) {
  console.error('Uso: npm run preparar-fotos -- <carpeta-origen> <slug> [--portada foto.jpg] [--portada-movil foto.jpg] [--plano plano.png] [--anadir]');
  process.exit(1);
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error('El slug solo puede llevar minúsculas sin tildes, números y guiones, por ejemplo vivienda-unifamiliar-tudela');

const PHOTO = /\.(jpe?g|png|webp|tiff?)$/i;
const dir = path.join('contenido', 'proyectos', slug);
const fotosDir = path.join(dir, 'fotos');
const resolveSource = file => (fs.existsSync(file) ? file : path.join(sourceDir, file));
const special = new Set([portadaMovil, plano].filter(Boolean).map(f => path.basename(f)));

const heic = fs.readdirSync(sourceDir).filter(f => /\.hei[cf]$/i.test(f));
if (heic.length) throw new Error(`Estas fotos están en HEIC y hay que pasarlas antes a JPG: ${heic.join(', ')}`);
const photos = fs.readdirSync(sourceDir).filter(f => PHOTO.test(f) && !special.has(f))
  .sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }));
if (!photos.length) throw new Error(`No hay fotos en ${sourceDir}`);

fs.mkdirSync(fotosDir, { recursive: true });
const existing = fs.readdirSync(fotosDir).filter(f => PHOTO.test(f));
if (existing.length && !append) throw new Error(`${fotosDir} ya tiene fotos. Usa --anadir para añadir más al final.`);

const warnings = [];
async function save(file, target, { maxSide, format = 'jpeg', minSide }) {
  const buffer = fs.readFileSync(file);
  const image = sharp(buffer).rotate();
  const meta = await sharp(buffer).metadata();
  const longSide = Math.max(meta.width, meta.height);
  if (minSide && longSide < minSide) warnings.push(`${path.basename(file)} mide ${meta.width}×${meta.height}px: puede verse poco nítida en pantallas grandes (ideal ${minSide}px o más en el lado largo).`);
  const resized = image.resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true });
  const data = format === 'webp' ? await resized.webp({ quality: 92 }).toBuffer() : await resized.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  fs.writeFileSync(target, data);
  console.log(`  ${path.basename(file)} → ${path.relative(process.cwd(), target)} (${Math.round(data.length / 1024)} KB)`);
}

console.log(`Preparando ${photos.length} fotos para ${slug}…`);
let n = existing.length;
let portadaName = null;
for (const photo of photos) {
  const name = `${String(++n).padStart(2, '0')}.jpg`;
  const isCover = portada && photo === path.basename(portada);
  if (isCover) portadaName = name;
  await save(path.join(sourceDir, photo), path.join(fotosDir, name), isCover ? { maxSide: 4000, minSide: 3000 } : { maxSide: 3000, minSide: 2000 });
}
if (portada && !portadaName) throw new Error(`La portada ${portada} no está entre las fotos de ${sourceDir}`);
if (portadaMovil) await save(resolveSource(portadaMovil), path.join(dir, 'portada-movil.jpg'), { maxSide: 4000, minSide: 2400 });
if (plano) await save(resolveSource(plano), path.join(dir, 'plano.webp'), { maxSide: 2400, format: 'webp' });

const mdFile = path.join(dir, 'proyecto.md');
if (!fs.existsSync(mdFile)) {
  fs.writeFileSync(mdFile, `---
titulo: Título completo del proyecto
titulo_corto: Título corto para la tarjeta
categoria: rehabilitación
ubicacion: Ciudad, Provincia
fecha: ${new Date().getFullYear()}-01
estado: Finalizada
${portadaName ? `portada: fotos/${portadaName}
` : ''}portada_alt: Descripción de la foto de portada
seo_titulo: Título para Google | Marcos Carrascosa
seo_descripcion: Una o dos frases para el resultado de Google.
ficha:
  Superficie: 000 m²
  Promotor: Privado
  Equipo: Marcos Carrascosa
  Fotografía: Marcos Carrascosa
---
`);
  console.log(`  Creado ${mdFile}: falta completar los datos.`);
}
else if (portadaName) console.log(`  Pon "portada: fotos/${portadaName}" en ${mdFile}`);
for (const w of warnings) console.warn(`Aviso: ${w}`);
