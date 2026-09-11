(() => {
  window.dataLayer = window.dataLayer || [];

  const push = (event, params = {}) => {
    window.dataLayer.push({ event, ...params });
  };

  const project = (() => {
    const match = window.location.pathname.match(/^\/proyectos\/([^/]+)\/?$/);
    return match ? match[1] : null;
  })();

  if (project) {
    push('project_view', { project_slug: project, project_name: document.querySelector('.project-title')?.textContent?.trim() || project });
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href') || '';
    const projectMatch = href.match(/^\/proyectos\/([^/]+)\/?$/);
    if (projectMatch) {
      push('project_select', { project_slug: projectMatch[1], project_name: link.dataset.projectTitle || link.textContent.trim() });
    }

    if (href === '/contacto' || href.startsWith('mailto:')) {
      push('contact_click', { link_type: href.startsWith('mailto:') ? 'email' : 'contact_page' });
    }
  });

  document.addEventListener('click', (event) => {
    const image = event.target.closest('.project-images img');
    if (!image) return;
    push('project_image_open', { project_slug: project || undefined, image_alt: image.alt || undefined });
  });
})();
