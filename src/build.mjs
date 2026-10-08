// Builds the whole site into public/ from contenido/. Run with: npm run build
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import { marked } from 'marked';
import { createImages } from './imagenes.mjs';
import * as T from './plantillas.mjs';

const ROOT = process.cwd();
const CONTENT = path.join(ROOT, 'contenido');
const SRC = path.join(ROOT, 'src');
const PUBLIC = path.join(ROOT, 'public');

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CATEGORY_ORDER = ['rehabilitación', 'espacio urbano', 'local comercial', 'educacional', 'vivienda'];
const IMAGE = /\.(jpe?g|png|webp|tiff?)$/i;
const natural = (a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

function readMarkdown(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`${path.relative(ROOT, file)}: falta la cabecera entre líneas ---`);
  return { data: YAML.parse(match[1]) || {}, body: match[2].trim() };
}

const site = YAML.parse(fs.readFileSync(path.join(CONTENT, 'sitio.yml'), 'utf8'));
const d = site.direccion;
const placeholders = {
  titular: site.legal.titular, nif: site.legal.nif, colegio: site.legal.colegio, colegiado: site.legal.colegiado,
  universidad: site.legal.universidad, email: site.email, telefono: site.telefono,
  direccion: `${d.calle}, ${d.piso}, ${d.cp} ${d.ciudad}`
};
const fill = text => text.replace(/\{\{(\w+)\}\}/g, (m, key) => placeholders[key] ?? m);
const markdown = text => marked.parse(text).replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');

// ---------- Projects ----------
function loadProject(slug) {
  const dir = path.join(CONTENT, 'proyectos', slug);
  const fail = msg => { throw new Error(`contenido/proyectos/${slug}: ${msg}`); };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail('el nombre de la carpeta solo puede llevar minúsculas sin tildes, números y guiones');
  if (!fs.existsSync(path.join(dir, 'proyecto.md'))) fail('falta el archivo proyecto.md');
  const { data, body } = readMarkdown(path.join(dir, 'proyecto.md'));
  for (const key of ['titulo', 'titulo_corto', 'categoria', 'ubicacion', 'fecha']) if (!data[key]) fail(`falta "${key}" en proyecto.md`);

  const fecha = String(data.fecha);
  if (!/^\d{4}(-(0[1-9]|1[0-2]))?$/.test(fecha)) fail('"fecha" debe tener el formato AAAA-MM (por ejemplo 2026-09) o AAAA');
  const [year, month] = fecha.split('-').map(Number);
  const fechaTexto = month ? `${capitalize(MONTHS[month - 1])}, ${year}` : String(year);

  const fotosDir = path.join(dir, 'fotos');
  const fotos = fs.existsSync(fotosDir) ? fs.readdirSync(fotosDir).filter(f => IMAGE.test(f)).sort(natural) : [];
  if (!fotos.length) fail('no hay fotos en la carpeta fotos/');
  const named = base => fs.readdirSync(dir).find(f => IMAGE.test(f) && path.parse(f).name.toLowerCase() === base);
  const pick = (key, base) => {
    if (data[key]) {
      const file = path.join(dir, data[key]);
      if (!fs.existsSync(file)) fail(`"${key}" apunta a ${data[key]}, que no existe`);
      return file;
    }
    return named(base) ? path.join(dir, named(base)) : null;
  };
  const portada = pick('portada', 'portada') || path.join(fotosDir, fotos[0]);
  const alts = data.fotos || {};
  for (const name of Object.keys(alts)) if (!fotos.includes(name)) fail(`hay un texto alternativo para fotos/${name}, pero esa foto no existe`);

  return {
    slug,
    titulo: data.titulo,
    tituloCorto: data.titulo_corto,
    categoria: String(data.categoria).trim().toLowerCase(),
    ubicacion: data.ubicacion,
    fecha,
    fechaTexto,
    estado: data.estado,
    inicio: data.inicio,
    seoTitulo: data.seo_titulo || `${data.titulo} | ${site.nombre}`,
    seoDescripcion: data.seo_descripcion || body.split(/(?<=\.)\s/)[0],
    files: {
      portada,
      portadaMovil: pick('portada_movil', 'portada-movil'),
      tarjeta: pick('tarjeta', 'tarjeta') || portada,
      plano: pick('plano', 'plano'),
      fotos: fotos.map(f => path.join(fotosDir, f))
    },
    portadaAlt: data.portada_alt || data.titulo,
    tarjetaAlt: data.tarjeta_alt || data.portada_alt || data.titulo,
    fotoAlts: fotos.map((f, i) => alts[f] || `${data.titulo_corto} — imagen ${i + 1}`),
    ficha: [['Fecha', fechaTexto], ['Estado', data.estado], ['Ubicación', data.ubicacion], ...Object.entries(data.ficha || {})].filter(([, v]) => v),
    texto: body ? markdown(body) : ''
  };
}

const projects = fs.readdirSync(path.join(CONTENT, 'proyectos'), { withFileTypes: true })
  .filter(e => e.isDirectory()).map(e => loadProject(e.name))
  .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.slug.localeCompare(b.slug));
const slides = projects.filter(p => p.inicio).sort((a, b) => a.inicio - b.inicio);
if (!slides.length) throw new Error('Ningún proyecto tiene "inicio": el carrusel de la portada quedaría vacío.');
const categories = [...new Set(projects.map(p => p.categoria))]
  .sort((a, b) => ((CATEGORY_ORDER.indexOf(a) + 1) || 99) - ((CATEGORY_ORDER.indexOf(b) + 1) || 99) || natural(a, b))
  .map(c => [c, capitalize(c)]);

// ---------- Images ----------
fs.rmSync(PUBLIC, { recursive: true, force: true });
fs.mkdirSync(PUBLIC, { recursive: true });
const images = createImages(PUBLIC);
const memo = new Map();
const responsive = (file, name, opts) => {
  const key = `${file}|${JSON.stringify(opts || {})}`;
  if (!memo.has(key)) memo.set(key, images.responsive(file, name, opts));
  return memo.get(key);
};
const PLAN = { quality: 90, widths: [800, 1600, 2400] };
// Full-screen covers: up to 3840 px for 4K and retina screens, and higher quality than the gallery
// because flat walls and skies show WebP artefacts at full screen
const COVER = { quality: 86, widths: [1280, 1920, 2560, 3200, 3840] };
// Phones in portrait only ever see the centre of a landscape cover: a 7:10 crop shows exactly that, with fewer bytes
const PHONE_COVER = { quality: 86, crop: 0.7, widths: [720, 1080, 1440, 1920] };
const baseName = file => path.parse(file).name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

await Promise.all(projects.map(async p => {
  const at = file => `proyectos/${p.slug}/${baseName(file)}`;
  const f = p.files;
  [p.portada, p.portadaMovil, p.tarjeta, p.plano, p.og] = await Promise.all([
    responsive(f.portada, at(f.portada), COVER),
    f.portadaMovil ? responsive(f.portadaMovil, at(f.portadaMovil)) : responsive(f.portada, `${at(f.portada)}-movil`, PHONE_COVER),
    responsive(f.tarjeta, at(f.tarjeta)),
    f.plano && responsive(f.plano, at(f.plano), PLAN),
    images.openGraph(f.portada, p.slug)
  ]);
  p.og.alt = p.portadaAlt;
  const fotos = await Promise.all(f.fotos.map(file => responsive(file, at(file))));
  p.galeria = fotos.map((image, i) => ({ image, alt: p.fotoAlts[i] }));
  if (p.plano) p.galeria.push({ image: p.plano, alt: `Plano de ${p.tituloCorto}` });
}));

const about = readMarkdown(path.join(CONTENT, 'sobre-mi.md'));
const portrait = await responsive(path.join(CONTENT, 'retrato.jpg'), 'estudio/retrato');
const portraitOg = { ...(await images.openGraph(path.join(CONTENT, 'retrato.jpg'), 'retrato')), alt: about.data.retrato_alt };
const homeOg = slides[0].og;

// ---------- Static assets ----------
function asset(file, ext) {
  const data = fs.readFileSync(path.join(SRC, file));
  const name = `assets/${path.parse(file).name}.${crypto.createHash('sha1').update(data).digest('hex').slice(0, 10)}${ext}`;
  fs.mkdirSync(path.join(PUBLIC, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(PUBLIC, name), data);
  return `/${name}`;
}
const assets = { css: asset('estilos.css', '.css'), js: asset('app.js', '.js') };
fs.copyFileSync(path.join(SRC, 'favicon.png'), path.join(PUBLIC, 'favicon.png'));

// ---------- Structured data ----------
const PERSON = `${site.url}/#marcos`;
const STUDIO = `${site.url}/#estudio`;
const person = {
  '@type': 'Person', '@id': PERSON, name: site.nombre, jobTitle: site.profesion, url: `${site.url}/sobre-mi`,
  image: site.url + portraitOg.url, alumniOf: { '@type': 'CollegeOrUniversity', name: site.legal.universidad },
  worksFor: { '@id': STUDIO }, sameAs: [site.instagram]
};
const studio = {
  '@type': 'ProfessionalService', '@id': STUDIO, name: site.marca, url: `${site.url}/`, email: site.email,
  telephone: site.telefono.replace(/\s/g, ''), image: site.url + homeOg.url,
  address: { '@type': 'PostalAddress', streetAddress: `${d.calle}, ${d.piso}`, postalCode: d.cp, addressLocality: d.ciudad, addressRegion: d.region, addressCountry: 'ES' },
  areaServed: site.seo.zonas.map(name => ({ '@type': 'AdministrativeArea', name })),
  founder: { '@id': PERSON }, sameAs: [site.instagram]
};
const graph = (...nodes) => ({ '@context': 'https://schema.org', '@graph': nodes });
const breadcrumb = (...items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item: site.url + item }))
});

// ---------- Pages ----------
const pages = [];
const page = (file, data) => pages.push([file, T.layout(site, assets, data)]);

page('index.html', {
  path: '/', title: site.seo.titulo, description: site.seo.descripcion, image: homeOg, bodyClass: 'immersive',
  main: T.homeMain(site, slides), footer: false,
  schema: [graph({ '@type': 'WebSite', '@id': `${site.url}/#web`, url: `${site.url}/`, name: site.marca, inLanguage: 'es', publisher: { '@id': STUDIO } }, studio, person)]
});

page('proyectos.html', {
  path: '/proyectos', title: `Proyectos de arquitectura | ${site.nombre}`, current: '/proyectos', image: homeOg,
  description: 'Proyectos de arquitectura en Zaragoza y Navarra: rehabilitación, patrimonio, equipamientos educativos, locales y espacio urbano.',
  main: T.projectsMain(projects, categories), svgDefs: T.PLAN_FILTER,
  schema: [graph(
    { '@type': 'CollectionPage', name: 'Proyectos', url: `${site.url}/proyectos`, hasPart: projects.map(p => ({ '@type': 'CreativeWork', name: p.titulo, url: `${site.url}/proyectos/${p.slug}/` })) },
    breadcrumb(['Inicio', '/'], ['Proyectos', '/proyectos'])
  )]
});

for (const p of projects) {
  const url = `/proyectos/${p.slug}/`;
  page(`proyectos/${p.slug}/index.html`, {
    path: url, title: p.seoTitulo, description: p.seoDescripcion, image: p.og, ogType: 'article', bodyClass: 'immersive', current: '/proyectos',
    main: T.projectMain(p), afterMain: T.LIGHTBOX,
    schema: [graph(
      {
        '@type': 'CreativeWork', '@id': `${site.url}${url}#proyecto`, name: p.titulo, headline: p.seoTitulo, description: p.seoDescripcion,
        url: site.url + url, inLanguage: 'es', dateCreated: p.fecha, genre: capitalize(p.categoria), creativeWorkStatus: p.estado,
        image: [site.url + p.og.url, site.url + p.portada.src], locationCreated: { '@type': 'Place', name: p.ubicacion },
        creator: { '@type': 'Person', '@id': PERSON, name: site.nombre }
      },
      breadcrumb(['Inicio', '/'], ['Proyectos', '/proyectos'], [p.titulo, url])
    )]
  });
}

page('sobre-mi.html', {
  path: '/sobre-mi', title: about.data.seo_titulo, description: about.data.seo_descripcion, image: portraitOg, ogType: 'profile', current: '/sobre-mi',
  main: T.aboutMain({ ...about.data, html: markdown(about.body) }, portrait),
  schema: [graph({ '@type': 'ProfilePage', url: `${site.url}/sobre-mi`, mainEntity: { '@id': PERSON } }, person)]
});

page('contacto.html', {
  path: '/contacto', title: `Contacto | ${site.nombre} Arquitecto`, current: '/contacto', image: homeOg,
  description: `Contacta con ${site.nombre}, arquitecto en Zaragoza y Navarra: email, teléfono y dirección del estudio.`,
  main: T.contactMain(site),
  schema: [graph({ '@type': 'ContactPage', url: `${site.url}/contacto`, about: { '@id': STUDIO } }, studio, person)]
});

for (const name of ['aviso-legal', 'privacidad', 'cookies']) {
  const doc = readMarkdown(path.join(CONTENT, 'legal', `${name}.md`));
  const html = markdown(fill(doc.body)).replace('<p>{{boton_cookies}}</p>', '<p><button type="button" class="button" data-open-consent>Cambiar preferencias de cookies</button></p>');
  page(`${name}.html`, {
    path: `/${name}`, title: `${doc.data.titulo} | ${site.nombre}`, description: doc.data.seo_descripcion, robots: 'noindex,follow',
    main: T.legalMain({ ...doc.data, html })
  });
}

page('404.html', { path: '/404', title: `Página no encontrada | ${site.nombre}`, description: site.seo.descripcion, robots: 'noindex', main: T.NOT_FOUND_MAIN });

for (const [file, html] of pages) {
  fs.mkdirSync(path.dirname(path.join(PUBLIC, file)), { recursive: true });
  fs.writeFileSync(path.join(PUBLIC, file), html);
}

// ---------- Sitemap and robots ----------
const indexable = ['/', '/proyectos', '/sobre-mi', '/contacto', ...projects.map(p => `/proyectos/${p.slug}/`)];
fs.writeFileSync(path.join(PUBLIC, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map(u => `  <url><loc>${site.url}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(PUBLIC, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

const stats = await images.done();

// ---------- Internal link check ----------
const rewrites = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).rewrites.map(r => [r.source, r.destination]));
const broken = new Set();
for (const [file, html] of pages) {
  const urls = [...html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)].map(m => m[1])
    .concat([...html.matchAll(/srcset="([^"]+)"/g)].flatMap(m => m[1].split(',').map(s => s.trim().split(' ')[0])));
  for (const url of urls) {
    const target = url === '/' ? '/index.html' : rewrites[url] || (url.endsWith('/') ? `${url}index.html` : url);
    if (!fs.existsSync(path.join(PUBLIC, decodeURI(target)))) broken.add(`${file} → ${url}`);
  }
}
if (broken.size) throw new Error(`Enlaces internos rotos:\n  ${[...broken].join('\n  ')}`);

console.log(`Web generada: ${projects.length} proyectos, ${pages.length} páginas, imágenes ${stats.encoded} nuevas y ${stats.cached} desde caché.`);
