import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export function buildDesign(root, output, config) {
  const template = fs.readFileSync(path.join(root, 'templates/site-design.html'), 'utf8');
  const script = template.match(/<script>([\s\S]*?)<\/script>/)[1];
  const projects = JSON.parse(script.match(/const projects=(\[.*?\]);/)[1]);
  const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const base = config.site.baseUrl;
  const routes = [
    ['/', 'index.html', config.site.defaultTitle, config.site.defaultDescription],
    ['/proyectos', 'proyectos.html', 'Proyectos | Marcos Carrascosa', 'Proyectos de arquitectura, rehabilitación, patrimonio y espacios públicos.'],
    ['/sobre-mi', 'sobre-mi.html', 'El estudio | Marcos Carrascosa', 'Marcos Carrascosa, arquitecto en Zaragoza y Navarra.'],
    ['/contacto', 'contacto.html', 'Contacto | Marcos Carrascosa', 'Contacta con el estudio de Marcos Carrascosa en Zaragoza.'],
    ...projects.map(p => [`/proyectos/${p.slug}/`, `proyectos/${p.slug}/index.html`, p.seoTitle, p.seoDescription, p])
  ];
  const oldIndex = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const gtm = oldIndex.match(/<script>\(function\(w,d,s,l,i\)[\s\S]*?<\/script>/)?.[0] || '';
  for (const [route, file, title, description, project] of routes) {
    const classes = new Set();
    const classList = { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), toggle() {} };
    const node = { classList, querySelectorAll: () => [], querySelector: () => node, addEventListener() {}, contains: () => false, innerHTML: '' };
    const main = { ...node };
    const context = {
      document: { body: { classList }, hidden: false, querySelector: selector => selector === 'main' ? main : node, querySelectorAll: () => [], addEventListener() {} },
      window: { addEventListener() {}, scrollTo() {} },
      location: { pathname: route, hash: '' }, matchMedia: () => ({ matches: false }),
      setInterval: () => 0, clearInterval() {}
    };
    vm.runInNewContext(script, context, { timeout: 1000 });
    const canonical = base + route;
    const image = `${base}/${project?.heroImage || project?.cardImage || 'img/portada/rehabilitacion-vestuarios-sdr-arenas.webp'}`;
    let html = template.replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
      .replace('<main id="main"></main>', `<main id="main">${main.innerHTML}</main>`)
      .replace('<body>', `<body class="${[...classes].join(' ')}">`);
    const metadata = `<meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#0F4C81">`;
    const verification = process.env.GOOGLE_SITE_VERIFICATION ? `<meta name="google-site-verification" content="${esc(process.env.GOOGLE_SITE_VERIFICATION)}">` : '';
    html = html.replace('</head>', `${metadata}${verification}${gtm}</head>`);
    const target = path.join(output, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, html);
    // Keep the existing legacy rewrite targets consistent with the canonical pages.
    if (project) fs.writeFileSync(path.join(output, `${project.slug}.html`), html);
  }
  console.log(`Diseño publicado: ${routes.length} páginas con contenido y SEO estáticos.`);
}
