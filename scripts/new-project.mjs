import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'proyectos.json');
const PROJECTS_DIR = path.join(ROOT, 'proyectos');

const rl = readline.createInterface({ input, output });
const ask = async (question, fallback = '') => {
  const value = (await rl.question(`${question}${fallback ? ` [${fallback}]` : ''}: `)).trim();
  return value || fallback;
};

try {
  console.log('\nNuevo proyecto\n');
  const slug = (await ask('Slug (ej. vivienda-zaragoza)')).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!slug) throw new Error('El slug es obligatorio.');

  const projects = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (projects.some(project => project.slug === slug)) throw new Error(`Ya existe el proyecto "${slug}".`);

  const title = await ask('Título');
  const location = await ask('Ubicación');
  const category = await ask('Categoría (rehabilitación, espacio urbano, local comercial, educacional, vivienda)');
  const description = await ask('Descripción SEO (1-2 frases)');
  const date = await ask('Fecha', '2026');
  const status = await ask('Estado', 'En proyecto');
  const area = await ask('Superficie');
  const client = await ask('Promotor');
  const budget = await ask('PEM');
  const contractor = await ask('Constructora');
  const team = await ask('Equipo', 'Marcos Carrascosa');
  const type = await ask('Tipo');
  const photography = await ask('Fotografía', 'Marcos Carrascosa');
  const featured = (await ask('¿Mostrar en portada? (s/n)', 'n')).toLowerCase() === 's';

  const folder = path.join(PROJECTS_DIR, slug);
  fs.mkdirSync(folder, { recursive: true });

  const project = {
    slug,
    title,
    location,
    category,
    description,
    cardTitle: title,
    cardImage: `proyectos/${slug}/01.webp`,
    cardAlt: title,
    featured,
    generate: true,
    date,
    status,
    area,
    client,
    budget,
    contractor,
    team,
    type,
    photography
  };

  projects.push(project);
  fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2) + '\n');

  fs.writeFileSync(path.join(folder, 'README.txt'), [
    `Proyecto: ${title}`,
    '',
    'Añade aquí las imágenes del proyecto.',
    'La primera imagen debe llamarse 01.webp y será la portada.',
    'Puedes añadir 02.webp, 03.webp, 04.webp, etc.',
    'Después ejecuta: npm run build'
  ].join('\n'));

  console.log(`\nCreado: proyectos/${slug}/`);
  console.log(`Añadido al catálogo: data/proyectos.json`);
  console.log('Siguiente paso: coloca las imágenes en la carpeta y ejecuta "npm run build".\n');
} finally {
  rl.close();
}
