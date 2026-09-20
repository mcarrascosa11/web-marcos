import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'site.json'), 'utf8'));
const PROJECTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'proyectos.json'), 'utf8'));
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'templates', 'proyecto.html'), 'utf8');
const HEAD = fs.readFileSync(path.join(ROOT, 'templates', 'partials', 'head-common.html'), 'utf8');
const HEADER = fs.readFileSync(path.join(ROOT, 'templates', 'partials', 'header.html'), 'utf8');
const FOOTER = fs.readFileSync(path.join(ROOT, 'templates', 'partials', 'footer.html'), 'utf8');
const PUBLIC = path.join(ROOT, 'public');
const BASE_URL = CONFIG.site.baseUrl.replace(/\/$/, '');
const PROJECT_PREFIX = CONFIG.seo.projectPathPrefix.endsWith('/') ? CONFIG.seo.projectPathPrefix : `${CONFIG.seo.projectPathPrefix}/`;
const esc = (v = '') => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const jsonLd = value => JSON.stringify(value).replace(/</g, '\\u003c');
const projectUrl = slug => `${BASE_URL}${PROJECT_PREFIX}${slug}/`;
const projectPath = slug => `${PROJECT_PREFIX}${slug}/`;
const PROJECT_SLUGS = new Set(PROJECTS.map(p => p.slug));
const rewriteProjectHref = (match, slug) => PROJECT_SLUGS.has(slug) ? `href="${projectPath(slug)}"` : match;

function validate() {
  const seen = new Set();
  for (const p of PROJECTS) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug || '')) throw new Error(`Slug inválido: ${p.slug}`);
    if (seen.has(p.slug)) throw new Error(`Slug duplicado: ${p.slug}`);
    seen.add(p.slug);
    if (p.generate && (!p.title || !p.location || !p.category || !p.description)) throw new Error(`Faltan datos obligatorios en ${p.slug}`);
  }
}

function copySite() {
  fs.rmSync(PUBLIC, { recursive: true, force: true });
  fs.mkdirSync(PUBLIC, { recursive: true });
  const ignored = new Set(['.git', '.vercel', 'node_modules', 'public', 'config', 'data', 'scripts', 'templates']);
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.name.startsWith('.')) continue;
    fs.cpSync(path.join(ROOT, entry.name), path.join(PUBLIC, entry.name), { recursive: true });
  }
}

function metadata(p) {
  const fields = [
    ['Fecha', p.date], ['Estado', p.status], ['Ubicación', p.location], ['Superficie', p.area],
    ['Promotor', p.client], ['PEM', p.budget], ['Constructora', p.contractor], ['Equipo de Arquitectos', p.team],
    ['Tipo', p.type], ['Fotografía', p.photography]
  ].filter(([, value]) => value);
  return fields.map(([label, value]) => `                <div class="meta-item"><span class="label">${esc(label)}</span><span class="value">${esc(value)}</span></div>`).join('\n');
}

function imagesFor(p) {
  const folder = path.join(ROOT, 'proyectos', p.slug);
  if (!fs.existsSync(folder)) throw new Error(`No existe proyectos/${p.slug}/`);
  return fs.readdirSync(folder).filter(f => /\.(webp|jpe?g|png)$/i.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function renderGenerated(p) {
  const files = imagesFor(p);
  if (!files.length) throw new Error(`No hay imágenes en proyectos/${p.slug}/`);
  const first = `/proyectos/${p.slug}/${files[0]}`;
  const title = p.seoTitle || `${p.title} | ${CONFIG.site.personName}`;
  const description = p.seoDescription || p.description;
  const url = projectUrl(p.slug);
  const schema = {
    '@context': 'https://schema.org', '@type': 'CreativeWork', name: p.title, headline: title, description,
    inLanguage: 'es', creator: { '@type': 'Person', name: CONFIG.site.personName },
    ...(p.datePublished ? { datePublished: p.datePublished } : {}), image: [`${BASE_URL}${first}`],
    url, mainEntityOfPage: { '@type': 'WebPage', '@id': url }, about: { '@type': 'Thing', name: p.category }, locationCreated: { '@type': 'Place', name: p.location }
  };
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Proyectos', item: `${BASE_URL}/proyectos` },
      { '@type': 'ListItem', position: 3, name: p.title, item: url }
    ]
  };
  const head = HEAD.replace('{{PERSON_NAME}}', esc(CONFIG.site.personName)).replace('{{SITE_NAME}}', esc(CONFIG.site.name))
    .replace('{{TITLE}}', esc(title)).replace('{{DESCRIPTION}}', esc(description)).replace('{{CANONICAL}}', url)
    .replace('{{OG_IMAGE}}', `${BASE_URL}${first}`).replace('{{OG_ALT}}', esc(p.cardAlt || p.title));
  const header = HEADER.replaceAll('{{PERSON_NAME}}', esc(CONFIG.site.personName)).replace('{{LAST_NAME}}', esc('Carrascosa'))
    .replace('{{PROFESSION}}', esc(CONFIG.site.profession));
  const footer = FOOTER.replaceAll('{{PERSON_NAME}}', esc(CONFIG.site.personName)).replaceAll('{{EMAIL}}', esc(CONFIG.site.email)).replaceAll('{{INSTAGRAM}}', esc(CONFIG.site.instagram));
  const imgs = files.map((f, i) => `<div class="photo-block"><img src="/proyectos/${esc(p.slug)}/${esc(f)}" decoding="async"${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'} alt="${esc(p.imageAlts?.[f] || (i === 0 ? p.cardAlt || p.title : `${p.title} — imagen ${i + 1}`))}"></div>`).join('\n');
  return TEMPLATE.replace('{{HEAD_COMMON}}', head).replace('{{VERIFICATION}}', '').replace('{{GTM_ID}}', esc(CONFIG.analytics.gtmId))
    .replace('{{SEO_TITLE}}', esc(title)).replace('{{PROJECT_TITLE}}', esc(p.title)).replace('{{DESCRIPTION}}', esc(description))
    .replace('{{SCHEMA}}', jsonLd(schema)).replace('{{BREADCRUMB}}', jsonLd(breadcrumb)).replace('{{HEADER}}', header)
    .replace('{{FOOTER}}', footer).replace('{{METADATA}}', metadata(p)).replace('{{IMAGES}}', imgs);
}

function patchPageMeta(html, title, description, canonical, ogImage) {
  const replaceMeta = (name, value) => {
    const re = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, 'i');
    return html.match(re) ? html.replace(re, `<meta name="${name}" content="${esc(value)}">`) : html;
  };
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  html = replaceMeta('description', description);
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${esc(canonical)}">`);
  html = html.replace(/(<meta\s+property=["']og:title["'][^>]*>)/i, `<meta property="og:title" content="${esc(title)}">`);
  html = html.replace(/(<meta\s+property=["']og:description["'][^>]*>)/i, `<meta property="og:description" content="${esc(description)}">`);
  html = html.replace(/(<meta\s+property=["']og:url["'][^>]*>)/i, `<meta property="og:url" content="${esc(canonical)}">`);
  html = html.replace(/(<meta\s+property=["']og:image["'][^>]*>)/i, `<meta property="og:image" content="${esc(ogImage)}">`);
  html = html.replace(/(<meta\s+name=["']twitter:title["'][^>]*>)/i, `<meta name="twitter:title" content="${esc(title)}">`);
  html = html.replace(/(<meta\s+name=["']twitter:description["'][^>]*>)/i, `<meta name="twitter:description" content="${esc(description)}">`);
  html = html.replace(/(<meta\s+name=["']twitter:image["'][^>]*>)/i, `<meta name="twitter:image" content="${esc(ogImage)}">`);
  if (!/<base\s+href=/i.test(html)) html = html.replace(/<head>/i, '<head>\n    <base href="/">');
  return html.replace(/href="index\.html"/g, 'href="/"').replace(/href="proyectos\.html"/g, 'href="/proyectos"').replace(/href="sobre-mi\.html"/g, 'href="/sobre-mi"').replace(/href="contacto\.html"/g, 'href="/contacto"');
}

function patchLegacyPages() {
  for (const p of PROJECTS.filter(x => !x.generate)) {
    const source = path.join(ROOT, `${p.slug}.html`);
    const target = path.join(PUBLIC, `${p.slug}.html`);
    if (!fs.existsSync(source)) continue;
    let html = fs.readFileSync(source, 'utf8');
    const title = p.seoTitle || `${p.title} | ${CONFIG.site.personName}`;
    const description = p.seoDescription || p.description || p.title;
    html = patchPageMeta(html, title, description, projectUrl(p.slug), `${BASE_URL}/${p.cardImage}`);
    html = html.replaceAll(`${BASE_URL}/${p.slug}.html`, projectUrl(p.slug));
    html = html.replaceAll('CIPF Rio Ebro', 'CIFP Río Ebro').replaceAll('Ampliación de clinica', 'Ampliación de clínica').replaceAll('Adecuación de local para clinica', 'Adecuación de local para clínica');
    fs.writeFileSync(target, html);
  }
}

function patchIndex() {
  const file = path.join(PUBLIC, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  html = patchPageMeta(html, CONFIG.site.defaultTitle, CONFIG.site.defaultDescription, `${BASE_URL}/`, `${BASE_URL}/img/proyecto1.webp`);
  html = html.replace(/href="([a-z0-9-]+)\.html"/g, (_, slug) => `href="${projectPath(slug)}"`);
  html = html.replace(/<nav(?![^>]*aria-label)/i, '<nav aria-label="Navegación principal"');
  html = html.replace(/<div class="slider-container">[\s\S]*?<\/div>\s*\n\s*<script>/i, match => {
    const close = match.lastIndexOf('<script>');
    const slides = PROJECTS.filter(p => p.featured).map((p, i) => `\n        <a href="${projectPath(p.slug)}" class="slide fade" aria-label="Ver proyecto: ${esc(p.title)}">\n            <img src="/${esc(p.cardImage)}" decoding="async"${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'} alt="${esc(p.cardAlt || p.title)}">\n            <div class="slide-info"><h2>${esc(p.title)}</h2><p>${esc(p.location)}</p></div>\n        </a>`).join('');
    const dots = PROJECTS.filter(p => p.featured).map((_, i) => `<span class="dot" onclick="currentSlide(${i + 1})"></span>`).join('\n            ');
    const block = `<div class="slider-container">${slides}\n\n        <a class="prev" href="#" role="button" aria-label="Proyecto anterior" onclick="event.preventDefault(); plusSlides(-1)">&#10094;</a>\n        <a class="next" href="#" role="button" aria-label="Proyecto siguiente" onclick="event.preventDefault(); plusSlides(1)">&#10095;</a>\n\n        <div class="dots-container">\n            ${dots}\n        </div>\n    </div>\n\n`;
    return block + '<script>';
  });
  fs.writeFileSync(file, html);
}

function patchProjectsPage() {
  const file = path.join(PUBLIC, 'proyectos.html');
  let html = fs.readFileSync(file, 'utf8');
  html = patchPageMeta(html, 'Proyectos de arquitectura | Marcos Carrascosa', 'Portfolio de arquitectura en Zaragoza y Navarra: rehabilitación, patrimonio, vivienda, locales y espacios públicos.', `${BASE_URL}/proyectos`, `${BASE_URL}/img/proyecto1.webp`);
  html = html.replace(/href="([a-z0-9-]+)\.html"/g, (_, slug) => `href="${projectPath(slug)}"`);
  html = html.replaceAll(`${BASE_URL}/proyectos.html`, `${BASE_URL}/proyectos`);
  html = html.replaceAll('clinica veterinaria', 'clínica veterinaria').replaceAll('Clinica fisioterapia', 'Clínica fisioterapia').replaceAll('CIPF Rio Ebro', 'CIFP Río Ebro');
  fs.writeFileSync(file, html);
}

function patchStaticSeo() {
  const pages = [
    ['sobre-mi.html', 'Marcos Carrascosa | Arquitecto en Zaragoza', 'Marcos Carrascosa es arquitecto en Zaragoza, especializado en rehabilitación, patrimonio y nuevas formas de habitar.', `${BASE_URL}/sobre-mi`],
    ['contacto.html', 'Contacto | Marcos Carrascosa Arquitecto', 'Contacto de Marcos Carrascosa, arquitecto en Zaragoza y Navarra. Consulta proyectos, encargos y colaboraciones.', `${BASE_URL}/contacto`]
  ];
  for (const [name, title, desc, url] of pages) {
    const file = path.join(PUBLIC, name);
    if (!fs.existsSync(file)) continue;
    let html = patchPageMeta(fs.readFileSync(file, 'utf8'), title, desc, url, `${BASE_URL}/img/proyecto1.webp`);
    html = html.replaceAll(`${BASE_URL}/${name}`, url);
    fs.writeFileSync(file, html);
  }
}

function generateNewProjects() {
  for (const p of PROJECTS.filter(x => x.generate)) {
    const output = path.join(PUBLIC, 'proyectos', p.slug, 'index.html');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, renderGenerated(p));
  }
}

function sitemap() {
  const urls = [`${BASE_URL}/`, `${BASE_URL}/proyectos`, `${BASE_URL}/sobre-mi`, `${BASE_URL}/contacto`, ...PROJECTS.map(p => projectUrl(p.slug))];
  fs.writeFileSync(path.join(PUBLIC, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
}

function analytics() {
  if (!CONFIG.analytics.eventsEnabled) return;
  const script = '<script defer src="/js/analytics.js"></script>';
  const visit = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith('.html')) {
        let html = fs.readFileSync(full, 'utf8');
        if (!html.includes(script)) html = html.replace(/<\/body>/i, `    ${script}\n</body>`);
        fs.writeFileSync(full, html);
      }
    }
  };
  visit(PUBLIC);
}

validate();
copySite();
patchLegacyPages();
patchIndex();
patchProjectsPage();
patchStaticSeo();
generateNewProjects();
sitemap();
analytics();
const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'optimize-images.mjs'), PUBLIC], { stdio: 'inherit' });
if (result.status !== 0) throw new Error('La optimización de imágenes ha fallado.');
console.log(`Build correcto: ${PROJECTS.length} proyectos, SEO y recursos preparados.`);
