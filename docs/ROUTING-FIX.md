# Fix de rutas de proyectos

Las fichas antiguas se sirven mediante `/proyectos/<slug>/` y apuntan a los HTML existentes en la raíz. Para evitar que el navegador resuelva CSS, imágenes y enlaces relativos dentro de `/proyectos/<slug>/`, el build convierte los recursos del contenido legado a rutas absolutas y no establece una caché larga para las páginas HTML de proyectos.
