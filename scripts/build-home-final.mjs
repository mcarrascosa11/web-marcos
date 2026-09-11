import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');
const C = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'site.json'), 'utf8'));
const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'proyectos.json'), 'utf8'));

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const yearOf = p => Number(p.year || String(p.datePublished || '').slice(0, 4) || 0);
const ordered = [...P].sort((a, b) => yearOf(b) - yearOf(a) || String(a.slug).localeCompare(String(b.slug)));
const featured = (C.home?.featuredOrder || []).map(slug => P.find(p => p.slug === slug)).filter(Boolean).slice(0, 5);
const categories = [...new Set(P.map(p => p.category).filter(Boolean))];
if (featured.length < 5) throw new Error(`Se esperaban 5 proyectos destacados y hay ${featured.length}.`);
if (!ordered.length) throw new Error('No hay proyectos en data/proyectos.json.');

const heroSlides = featured.map((p, i) => `
  <a class="hero-slide${i === 0 ? ' is-active' : ''}" href="/proyectos/${esc(p.slug)}/" aria-label="Ver ${esc(p.title)}">
    <img src="/${esc(p.cardImage)}" alt="${esc(p.cardAlt || p.title)}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
    <div class="hero-caption"><h2>${esc(p.title)}</h2><div class="hero-meta"><span>${esc(p.location)}</span><span>${yearOf(p)}</span></div></div>
  </a>`).join('');
const dots = featured.map((_, i) => `<button class="hero-dot${i === 0 ? ' is-active' : ''}" type="button" data-slide="${i}" aria-label="Ir al proyecto ${i + 1}"></button>`).join('');
const filters = `<button class="project-filter is-active" type="button" data-filter="all">Todos</button>${categories.map(c => `<button class="project-filter" type="button" data-filter="${esc(c)}">${esc(c)}</button>`).join('')}`;
const timeline = ordered.map((p, i) => `
<article class="project-item" data-category="${esc(p.category)}" data-index="${i}">
  <div class="project-year">${yearOf(p)}</div>
  <a class="project-image reveal" href="/proyectos/${esc(p.slug)}/" aria-label="Ver ${esc(p.title)}"><img src="/${esc(p.cardImage)}" alt="${esc(p.cardAlt || p.title)}" loading="lazy" decoding="async"></a>
  <div class="project-copy reveal"><div class="project-category">${esc(p.category)}</div><h2>${esc(p.title)}</h2><p>${esc(p.location)}</p><a class="project-link" href="/proyectos/${esc(p.slug)}/">Ver proyecto <span>↗</span></a></div>
</article>`).join('');
const first = ordered[0];
const transition = `<a class="hero-transition-project" href="/proyectos/${esc(first.slug)}/" aria-label="Ver ${esc(first.title)}"><img src="/${esc(first.cardImage)}" alt="${esc(first.cardAlt || first.title)}" loading="lazy" decoding="async"><div class="transition-overlay"></div><div class="transition-copy"><span class="transition-category">${esc(first.category)}</span><h2>${esc(first.title)}</h2><div><span>${esc(first.location)}</span><span>${yearOf(first)}</span></div></div></a>`;

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(C.site.defaultTitle)}</title><meta name="description" content="${esc(C.site.defaultDescription)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${esc(C.site.baseUrl)}/"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/redesign-final.css"><link rel="icon" href="/img/favicon.png">
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${esc(C.analytics.gtmId)}');</script></head>
<body class="home-redesign-final"><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${esc(C.analytics.gtmId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript><h1 class="seo-only">${esc(C.site.defaultTitle)}</h1>
<header class="site-header"><a class="site-brand" href="/" aria-label="Inicio"><span>Marcos <strong>Carrascosa</strong></span><small>A R Q U I T E C T U R A</small></a><nav aria-label="Navegación principal"><a href="#proyectos">Proyectos</a><a href="#sobre-mi">Sobre mí</a><a href="#contacto">Contacto</a></nav></header>
<main><section class="hero-stage"><section class="hero"><div class="hero-slides">${heroSlides}</div><div class="hero-dots">${dots}</div><div class="hero-scroll">Scroll <i></i></div></section><div class="hero-transition-spacer"></div>${transition}</section>
<section id="proyectos" class="projects-section"><div class="filter-row">${filters}</div><div class="project-list">${timeline}</div></section>
<section id="sobre-mi" class="about-section"><div class="about-wrap"><div class="about-photo reveal"><img src="/img/SobreMi.webp" alt="Retrato de Marcos Carrascosa, arquitecto en Zaragoza" loading="lazy"></div><div class="about-text reveal"><span class="eyebrow">Sobre mí</span><p class="about-lead">Arquitectura desde el contexto, la rehabilitación y la memoria del lugar.</p><p>Soy arquitecto por la Escuela de Ingeniería y Arquitectura de la Universidad de Zaragoza. Mi práctica combina rehabilitación, patrimonio, vivienda y espacio urbano.</p><p>Desde 2023 desarrollo mi actividad desde Zaragoza, manteniendo una relación profesional con Navarra y con proyectos vinculados al territorio.</p><a href="/sobre-mi" class="text-link">Conocer trayectoria ↗</a></div></div></section>
<section id="contacto" class="contact-section"><h2>Contacto</h2><div class="contact-links"><a href="mailto:${esc(C.site.email)}">${esc(C.site.email)}</a><a href="tel:${esc(C.site.phone || '+34699828171')}">${esc(C.site.phoneDisplay || '699 828 171')}</a><a href="${esc(C.site.instagram)}" target="_blank" rel="noopener noreferrer">Instagram</a></div></section></main>
<footer class="site-footer">© ${new Date().getFullYear()} ${esc(C.site.personName)} · Arquitectura</footer>
<script>
(() => {
 const slides=[...document.querySelectorAll('.hero-slide')],dots=[...document.querySelectorAll('.hero-dot')];let current=0,timer;
 const show=n=>{if(!slides.length)return;current=(n+slides.length)%slides.length;slides.forEach((s,i)=>s.classList.toggle('is-active',i===current));dots.forEach((d,i)=>d.classList.toggle('is-active',i===current));};
 const restart=()=>{clearInterval(timer);timer=setInterval(()=>show(current+1),5500)};dots.forEach(d=>d.addEventListener('click',()=>{show(Number(d.dataset.slide));restart()}));show(0);restart();
 const header=document.querySelector('.site-header'),stage=document.querySelector('.hero-stage'),transition=document.querySelector('.hero-transition-project');let lastY=window.scrollY,raf=0;
 const update=()=>{raf=0;const y=window.scrollY;if(header){if(y>80&&y>lastY+2)header.classList.add('header-hidden');else if(y<lastY-2||y<30)header.classList.remove('header-hidden')}if(stage&&transition){const r=stage.getBoundingClientRect(),vh=innerHeight,p=Math.min(1,Math.max(0,(vh-r.top)/(vh*.95)));transition.style.setProperty('--transition-p',p.toFixed(4))}lastY=y};
 const request=()=>{if(!raf)raf=requestAnimationFrame(update)};addEventListener('scroll',request,{passive:true});addEventListener('resize',request,{passive:true});update();
 const items=[...document.querySelectorAll('.project-item')];const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('is-visible')}),{threshold:.08,rootMargin:'0px 0px -10% 0px'});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
 const buttons=[...document.querySelectorAll('.project-filter')];buttons.forEach(btn=>btn.addEventListener('click',()=>{const filter=btn.dataset.filter;buttons.forEach(b=>b.classList.toggle('is-active',b===btn));const visible=[];items.forEach(item=>{const yes=filter==='all'||item.dataset.category===filter;item.hidden=!yes;if(yes)visible.push(item)});visible.forEach((item,i)=>item.animate([{opacity:0,transform:'translateY(55px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:720+Math.min(i*40,240),delay:i*25,easing:'cubic-bezier(.16,.8,.24,1)',fill:'both'}));}));
})();
</script><script defer src="/_vercel/speed-insights/script.js"></script><script defer src="/js/analytics.js"></script></body></html>`;
fs.writeFileSync(path.join(PUBLIC,'index.html'), html);
console.log(`Home final: ${featured.length} destacados, ${ordered.length} proyectos, transición directa al proyecto ${first.slug}.`);
