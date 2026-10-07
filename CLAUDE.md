# Web de Marcos Carrascosa (marcoscarrascosa.com)

Portfolio de arquitectura. HTML estático generado con Node y publicado en Vercel (proyecto `web-marcos`).
Cada push a `main` se publica en producción en 1-2 minutos; las demás ramas generan una preview.

Marcos no toca código: manda fotos y textos y Claude publica. Todo el contenido está en `contenido/`;
`src/` solo se toca para cambiar el diseño o el funcionamiento.

## Estructura

```
contenido/
  sitio.yml                 datos del estudio, textos de inicio, SEO general, GTM
  sobre-mi.md               biografía (página Estudio)
  retrato.jpg               foto de la página Estudio
  legal/*.md                aviso legal, privacidad, cookies ({{email}}, {{nif}}… salen de sitio.yml)
  proyectos/<slug>/
    proyecto.md             ficha y texto del proyecto
    fotos/01.jpg, 02.jpg…   galería, en orden de nombre
    plano.webp              opcional: plano de la tarjeta (se tiñe de azul) y última imagen de la galería
    portada.*               opcional: si no, la portada es `portada:` del .md o la primera foto
    portada-movil.*         opcional: versión vertical de la portada para móviles
    tarjeta.*               opcional: foto de la tarjeta del listado si no es la portada
src/
  build.mjs                 genera public/ (páginas, imágenes, sitemap, robots) y comprueba enlaces
  plantillas.mjs            HTML de cada página
  estilos.css, app.js       diseño y comportamiento (carrusel, filtros, visor, aviso de cookies)
  imagenes.mjs              versiones responsive WebP + imagen para redes (1200×630)
  preparar-fotos.mjs        importa fotos originales a un proyecto
```

`public/` se genera en cada build y no se versiona. Las URLs de producción no deben cambiar:
`/`, `/proyectos`, `/proyectos/<slug>/`, `/sobre-mi`, `/contacto`, `/aviso-legal`, `/privacidad`, `/cookies`.
Las redirecciones de URLs antiguas están en `vercel.json`.

## Publicar un proyecto nuevo

1. `npm install` (la primera vez).
2. Importa las fotos originales (JPG/PNG/WebP; las HEIC del iPhone hay que convertirlas antes):
   `npm run preparar-fotos -- "<carpeta con las fotos>" <slug> --portada <foto.jpg> [--plano plano.png] [--portada-movil vertical.jpg]`
   - El slug va en minúsculas, sin tildes, con guiones y con palabras útiles para Google: `vivienda-unifamiliar-tudela`.
   - Las fotos se numeran por orden de nombre de archivo. Si Marcos indica otro orden, renómbralas antes.
   - Avisa a Marcos si el script dice que alguna foto es pequeña: la portada necesita 3000 px o más en el lado largo para verse nítida.
3. Completa `contenido/proyectos/<slug>/proyecto.md` (el script crea la plantilla). Campos:
   - Obligatorios: `titulo`, `titulo_corto` (tarjeta y cabecera), `categoria`, `ubicacion`, `fecha` (`AAAA-MM`).
   - `categoria`: rehabilitación, espacio urbano, local comercial, educacional o vivienda. Una categoría nueva crea su filtro sola.
   - `estado`, `portada`, `portada_alt`, `tarjeta_alt`, `titulo_cabecera` (si el título de la cabecera debe ser distinto).
   - `inicio: N` lo pone en el carrusel de la portada en la posición N (hay que reordenar los demás si hace falta).
   - `seo_titulo` (unos 60 caracteres, con tipo de obra y lugar) y `seo_descripcion` (unos 150 caracteres).
   - `ficha:` líneas `Etiqueta: valor` en el orden en que se muestran (Superficie, Promotor, PEM, Constructora, Equipo, Tipo, Fotografía…).
   - `fotos:` textos alternativos por archivo (`03.jpg: Patio interior con la escalera de madera`). Los que falten se generan solos.
   - Debajo de la cabecera va el texto del proyecto en párrafos. Respeta la redacción de Marcos; corrige solo erratas y tildes.
4. `npm run build`: valida los datos y falla con un mensaje claro si algo está mal.
5. Revisa el resultado en local antes de publicar (listado, ficha, móvil).
6. Commit y push a `main`. Comprueba en https://www.marcoscarrascosa.com/proyectos/<slug>/ que está publicado.

## Notas

- El aviso de cookies es obligatorio (RGPD/LSSI): Google Tag Manager solo se carga tras "Aceptar". No cargues
  scripts de terceros ni fuentes externas sin pasar por ese consentimiento y actualizar `contenido/legal/`.
- Las imágenes procesadas se cachean en `node_modules/.cache/web-imagenes`; si cambias el procesado sube
  `PIPELINE_VERSION` en `src/imagenes.mjs`.
- En Windows la carpeta del repo puede superar la longitud máxima de ruta: usa `git config core.longpaths true`.
