// HTML templates. Every page is rendered at build time; src/app.js only adds behaviour.
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jsonLd = data => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

// sizes: value of the HTML sizes attribute; priority: true for the main above-the-fold image
export function img(image, alt, { sizes = '100vw', priority = false, className = '' } = {}) {
  const loading = priority ? 'fetchpriority="high"' : 'loading="lazy"';
  return `<img${className ? ` class="${className}"` : ''} src="${image.src}" srcset="${image.srcset}" sizes="${sizes}" width="${image.width}" height="${image.height}" alt="${esc(alt)}" ${loading} decoding="async">`;
}

// Full-bleed photo with object-fit:cover. The sizes hint accounts for the crop on tall screens.
const coverSizes = image => `(max-aspect-ratio: ${image.width}/${image.height}) calc(100vh * ${(image.width / image.height).toFixed(3)}), 100vw`;

export function coverImg(image, alt, { mobile, priority = false } = {}) {
  const main = img(image, alt, { sizes: coverSizes(image), priority });
  if (!mobile) return main;
  return `<picture><source media="(max-width: 600px) and (orientation: portrait)" srcset="${mobile.srcset}" sizes="${coverSizes(mobile)}">${main}</picture>`;
}

const NAV = [['/proyectos', 'Proyectos'], ['/sobre-mi', 'Estudio'], ['/contacto', 'Contacto']];

export function layout(site, assets, page) {
  const {
    title, description, path, image, ogType = 'website', robots = 'index,follow',
    bodyClass = '', current = '', main, schema = [], afterMain = '', svgDefs = '', footer = true
  } = page;
  const url = site.url + path;
  return `<!doctype html>
<html lang="es" data-gtm="${esc(site.gtm)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(site.marca)}">
<meta property="og:locale" content="es_ES">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
${image ? `<meta property="og:image" content="${site.url}${image.url}">
<meta property="og:image:width" content="${image.width}">
<meta property="og:image:height" content="${image.height}">
<meta property="og:image:alt" content="${esc(image.alt)}">
` : ''}<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0F4C81">
<link rel="icon" href="/favicon.png">
<link rel="stylesheet" href="${assets.css}">
<script defer src="${assets.js}"></script>
${schema.map(jsonLd).join('\n')}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
${svgDefs}<header><div class="header-inner"><a class="brand" href="/"><strong>Marcos</strong> Carrascosa</a><nav aria-label="Navegación principal">${NAV.map(([href, label]) => `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav></div></header>
<main id="main">${main}</main>
${footer ? `<footer><span>Marcos Carrascosa · Arquitectura</span><a class="footer-email" href="mailto:${esc(site.email)}">${esc(site.email)}</a><div class="footer-links"><a href="/aviso-legal">Aviso legal</a><a href="/privacidad">Privacidad</a><a href="/cookies">Cookies</a><a href="${esc(site.instagram)}" target="_blank" rel="noopener">Instagram ↗</a></div></footer>
` : ''}${afterMain}<div class="cookie-banner" role="region" aria-label="Aviso de cookies" hidden><p>Esta web usa cookies de análisis de Google para saber cómo se utiliza, solo si las aceptas. <a href="/cookies">Más información</a></p><div class="cookie-actions"><button type="button" data-consent="rechazar">Rechazar</button><button type="button" data-consent="aceptar">Aceptar</button></div></div>
</body>
</html>
`;
}

// Turns the Classic Blue tint on for the plan drawings in the project grid
export const PLAN_FILTER = '<svg aria-hidden="true" width="0" height="0" style="position:absolute;pointer-events:none"><defs><filter id="plan-brand-blue" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.20009411764705884 0.6731294117647059 0.06795294117647059 0 0.058823529411764705 0.14923686274509804 0.5020423529411764 0.050681568627450976 0 0.2980392156862745 0.10504941176470589 0.3533929411764706 0.03567529411764706 0 0.5058823529411764 0 0 0 1 0"/></filter></defs></svg>';

export function homeMain(site, slides) {
  // The home page is only the carousel; the H1 is there for search engines and screen readers
  const heading = `<h1 class="sr-only">${esc(site.inicio.titulo)}</h1>`;
  const stage = `<section class="home-stage" aria-label="Carrusel de proyectos seleccionados">${slides.map((p, i) => `<a class="original-slide${i === 0 ? ' active' : ''}" href="/proyectos/${p.slug}/"${i ? ' tabindex="-1" aria-hidden="true"' : ''} data-project-title="${esc(p.titulo)}">${coverImg(p.portada, p.portadaAlt, { mobile: p.portadaMovil, priority: i === 0 })}<div class="original-info"><h2>${esc(p.titulo)}</h2><p>${esc(p.ubicacion)}</p></div></a>`).join('')}<button class="original-prev" data-direction="-1" aria-label="Proyecto anterior">❮</button><button class="original-next" data-direction="1" aria-label="Proyecto siguiente">❯</button><div class="original-dots">${slides.map((_, i) => `<button data-slide="${i}" aria-label="Ir al proyecto ${i + 1}" aria-current="${i === 0}"></button>`).join('')}</div></section>`;
  return heading + stage;
}

const CARD_SIZES = '(max-width: 600px) 50vw, (max-width: 1000px) 34vw, 25vw';

function card(p) {
  const photo = img(p.tarjeta, p.tarjetaAlt, { sizes: CARD_SIZES });
  const media = p.plano
    ? `<div class="card-media has-plan"><div class="plan-image">${img(p.plano, `Plano de ${p.tituloCorto}`, { sizes: CARD_SIZES })}</div><div class="hover-photo">${photo}</div></div>`
    : `<div class="card-media">${photo}</div>`;
  return `<a class="card" href="/proyectos/${p.slug}/" data-category="${esc(p.categoria)}" data-project-title="${esc(p.titulo)}">${media}<div class="card-caption"><h2>${esc(p.tituloCorto)}</h2><div class="card-meta"><span>${esc(p.ubicacion)}</span><span>${esc(p.fechaTexto)}</span></div></div></a>`;
}

export function projectsMain(projects, categories) {
  const count = n => `${n} ${n === 1 ? 'proyecto' : 'proyectos'}`;
  return `<section class="projects-page"><h1 class="sr-only">Proyectos de arquitectura</h1><div class="filters" role="group" aria-label="Filtrar proyectos por tipo"><button data-filter="Todos" aria-pressed="true">Todos</button>${categories.map(([value, label]) => `<button data-filter="${esc(value)}" aria-pressed="false">${esc(label)}</button>`).join('')}<span class="project-count">${count(projects.length)}</span></div><div class="grid">${projects.map(card).join('')}</div></section>`;
}

const GALLERY_FULL = '(max-width: 600px) calc(100vw - 36px), calc(100vw - 56px)';
const GALLERY_HALF = '(max-width: 600px) calc(100vw - 36px), calc(50vw - 36px)';

export function projectMain(p) {
  const meta = p.ficha.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  const gallery = p.galeria.map((im, i) => `<div><button data-photo="${i}" aria-label="Ampliar imagen ${i + 1}">${img(im.image, im.alt, { sizes: i % 5 === 0 ? GALLERY_FULL : GALLERY_HALF })}</button></div>`).join('');
  return `<section class="detail-hero">${coverImg(p.portada, p.portadaAlt, { mobile: p.portadaMovil, priority: true })}<p class="hero-title">${esc(p.tituloCabecera)}</p></section><section class="detail-info"><dl class="metadata">${meta}</dl><div class="detail-intro"><h1>${esc(p.titulo)}</h1><div class="sub">${esc(p.ubicacion)} · ${esc(p.fechaTexto)}</div>${p.texto ? `<div class="detail-text">${p.texto}</div>` : ''}<a class="back" href="/proyectos">← Todos los proyectos</a></div></section><div class="gallery">${gallery}</div>`;
}

export const LIGHTBOX = '<dialog class="lightbox" aria-label="Galería de imágenes"><button class="lb-close">Cerrar ×</button><button class="lb-prev" aria-label="Imagen anterior">‹</button><img alt=""><button class="lb-next" aria-label="Imagen siguiente">›</button></dialog>\n';

export function aboutMain(about, portrait) {
  return `<section class="about"><div class="about-portrait">${img(portrait, about.retrato_alt, { sizes: '(max-width: 600px) calc(100vw - 36px), 40vw', priority: true })}</div><div class="about-copy"><p class="eyebrow">Sobre mí</p><h1>Marcos Carrascosa</h1><blockquote>${esc(about.cita)}</blockquote>${about.html}<a class="back" href="/contacto">Contacto ↗</a></div></section>`;
}

export function contactMain(site) {
  const d = site.direccion;
  const tel = site.telefono.replace(/\s/g, '');
  return `<section class="contact"><h1>Contacto</h1><div class="contact-grid"><div><a class="email" href="mailto:${esc(site.email)}">${esc(site.email)} ↗</a><p style="margin-top:25px"><a href="tel:${esc(tel)}">${esc(site.telefono)}</a></p></div><div><p>${esc(d.calle)} · ${esc(d.piso)}<br>${esc(d.cp)} ${esc(d.ciudad)}</p><p><a href="${esc(site.instagram)}" target="_blank" rel="noopener">Instagram ↗</a></p></div></div></section>`;
}

export function legalMain(doc) {
  return `<article class="legal"><h1>${esc(doc.titulo)}</h1>${doc.html}${doc.actualizado ? `<p class="updated">Última actualización: ${esc(doc.actualizado)}</p>` : ''}</article>`;
}

export const NOT_FOUND_MAIN = '<article class="legal"><h1>Página no encontrada</h1><p>Es posible que el enlace esté roto o que la página se haya movido.</p><p><a href="/">Volver al inicio</a> · <a href="/proyectos">Ver proyectos</a></p></article>';
