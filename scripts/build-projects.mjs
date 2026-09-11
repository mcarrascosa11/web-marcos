import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'proyectos.json');
const TEMPLATE_FILE = path.join(ROOT, 'templates', 'proyecto.html');
const BASE_URL = 'https://www.marcoscarrascosa.com';

const projects = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const escapeJsonLd = value => JSON.stringify(value).replace(/</g, '\\u003c');

const requiredForGenerated = ['slug', 'title', 'location', 'category', 'description'];

function imageFiles(project) {
  if (Array.isArray(project.images) && project.images.length) return project.images;
  const folder = path.join(ROOT, 'proyectos', project.slug);
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder)
    .filter(file => /\.(webp|jpe?g|png)$/i.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function metadata(project) {
  const fields = [
    ['Fecha', project.date],
    ['Estado', project.status],
    ['Ubicación', project.location],
    ['Superficie', project.area],
    ['Promotor', project.client],
    ['PEM', project.budget],
    ['Constructora', project.contractor],
    ['Equipo', project.team],
    ['Tipo', project.type],
    ['Fotografía', project.photography]
  ].filter(([, value]) => value);

  return fields.map(([label, value]) => `            <div class="meta-item"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`).join('\n');
}

function renderImages(project, files) {
  if (!files.length) {
    throw new Error(`El proyecto "${project.slug}" no tiene imágenes. Añade imágenes a proyectos/${project.slug}/.`);
  }

  return files.map((file, index) => {
    const alt = project.imageAlts?.[file] || (index === 0 ? project.cardAlt || project.title : `${project.title} — imagen ${index + 1}`);
    const src = `proyectos/${project.slug}/${file}`;
    return `            <div class="photo-block"><img src="${escapeHtml(src)}"${index > 0 ? ' loading="lazy"' : ''} alt="${escapeHtml(alt)}"></div>`;
  }).join('\n');
}

function renderProject(project) {
  for (const field of requiredForGenerated) {
    if (!project[field]) throw new Error(`Falta "${field}" en el proyecto "${project.slug}".`);
  }

  const files = imageFiles(project);
  const firstImage = files[0] ? `proyectos/${project.slug}/${files[0]}` : project.cardImage;
  if (!firstImage) throw new Error(`El proyecto "${project.slug}" no tiene imagen principal.`);

  const description = project.description;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: project.title,
    description,
    author: { '@type': 'Person', name: 'Marcos Carrascosa' },
    ...(project.datePublished ? { datePublished: project.datePublished } : {}),
    image: `${BASE_URL}/${firstImage}`,
    url: `${BASE_URL}/${project.slug}.html`
  };

  return template
    .replaceAll('{{TITLE}}', escapeHtml(project.title))
    .replaceAll('{{DESCRIPTION}}', escapeHtml(description))
    .replaceAll('{{SLUG}}', escapeHtml(project.slug))
    .replaceAll('{{OG_IMAGE}}', escapeHtml(firstImage))
    .replaceAll('{{OG_ALT}}', escapeHtml(project.cardAlt || project.title))
    .replace('{{SCHEMA}}', escapeJsonLd(schema))
    .replace('{{METADATA}}', metadata(project))
    .replace('{{IMAGES}}', renderImages(project, files));
}

function sliderMarkup() {
  const featured = projects.filter(project => project.featured);
  const slides = featured.map((project, index) => `
        <a href="${escapeHtml(project.slug)}.html" class="slide fade" aria-label="Ver proyecto: ${escapeHtml(project.title)}">
            <img src="${escapeHtml(project.cardImage)}"${index === 0 ? '' : ' loading="lazy"'} alt="${escapeHtml(project.cardAlt || project.title)}">
            <div class="slide-info">
                <h2>${escapeHtml(project.title)}</h2>
                <p>${escapeHtml(project.location)}</p>
            </div>
        </a>`).join('\n');

  const dots = featured.map((_, index) => `            <button class="dot" type="button" aria-label="Ir al proyecto ${index + 1}" onclick="currentSlide(${index + 1})"></button>`).join('\n');

  return `${slides}\n\n        <button class="prev" type="button" aria-label="Proyecto anterior" onclick="plusSlides(-1)">&#10094;</button>\n        <button class="next" type="button" aria-label="Proyecto siguiente" onclick="plusSlides(1)">&#10095;</button>\n\n        <div class="dots-container">\n${dots}\n        </div>`;
}

function cardsMarkup() {
  return projects.map(project => `
            <a href="${escapeHtml(project.slug)}.html" class="proyecto" data-category="${escapeHtml(project.category)}">
                <div class="img-wrapper">
                    <img src="${escapeHtml(project.cardImage)}" loading="lazy" alt="${escapeHtml(project.cardAlt || project.title)}">
                    <div class="overlay"><h2>${escapeHtml(project.cardTitle || project.title)}</h2></div>
                </div>
            </a>`).join('\n');
}

function updateIndex() {
  const file = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const start = '<!-- PROJECTS_SLIDER_START -->';
  const end = '<!-- PROJECTS_SLIDER_END -->';
  const block = `${start}\n${sliderMarkup()}\n        ${end}`;

  if (html.includes(start) && html.includes(end)) {
    html = html.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
  } else {
    html = html.replace(/<div class="slider-container">[\s\S]*?\n    <\/div>\s*\n\s*<script>\s*\n\s*let slideIndex/, `<div class="slider-container">\n        ${block}\n    </div>\n\n<script>\n    let slideIndex`);
  }
  fs.writeFileSync(file, html);
}

function updateProjectsPage() {
  const file = path.join(ROOT, 'proyectos.html');
  let html = fs.readFileSync(file, 'utf8');
  const start = '<!-- PROJECTS_GRID_START -->';
  const end = '<!-- PROJECTS_GRID_END -->';
  const block = `${start}\n${cardsMarkup()}\n        ${end}`;

  if (html.includes(start) && html.includes(end)) {
    html = html.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
  } else {
    html = html.replace(/<div class="grid">[\s\S]*?<\/div>\s*<\/section>\s*<footer>/, `<div class="grid">\n            ${block}\n        </div>\n    </section>\n\n  <footer>`);
  }
  fs.writeFileSync(file, html);
}

function updateSitemap() {
  const staticUrls = [
    ['', '1.0'],
    ['proyectos.html', '0.9'],
    ['sobre-mi.html', '0.8'],
    ['contacto.html', '0.8'],
    ['avisolegal1.html', '0.3'],
    ['privacidad1.html', '0.3']
  ];
  const projectUrls = projects.map(project => [project.slug + '.html', '0.7']);
  const urls = [...staticUrls, ...projectUrls];
  const body = urls.map(([url, priority]) => `  <url>\n    <loc>${BASE_URL}/${url}</loc>\n    <priority>${priority}</priority>\n  </url>`).join('\n');
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
}

for (const project of projects) {
  if (!project.generate) continue;
  const output = path.join(ROOT, `${project.slug}.html`);
  fs.writeFileSync(output, renderProject(project));
  console.log(`Generado: ${project.slug}.html`);
}

updateIndex();
updateProjectsPage();
updateSitemap();
console.log(`Catálogo procesado: ${projects.length} proyectos.`);
