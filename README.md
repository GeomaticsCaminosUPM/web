# Web del grupo AGA (Aplicaciones Geomáticas Avanzadas · UPM)

Sitio estático (Inicio, Líneas, Proyectos, Papers, Eventos, Conferencias y Personas) con una identidad visual
propia basada en el lenguaje de los mapas. Contenido y logos tomados de <https://blogs.upm.es/aga/>.

No hay que tocar HTML ni código para añadir contenido.

## Uso rápido

Requiere Node ≥ 18 (sin dependencias, no hay `npm install`).

```bash
npm run build     # genera ./docs (el sitio publicable)
npm run serve     # build + servidor en http://localhost:8000
```

El resultado generado está en `docs/` y **se sube al repositorio**: después de cambiar contenido ejecuta `npm run build` y haz commit de `docs/`.

### Publicar en GitHub Pages (sin Actions)
1. Ejecuta `npm run build` y haz commit + push de todo, incluida la carpeta `docs/`.
2. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, carpeta `/docs`** → Save.
3. La web queda en `https://<org>.github.io/<repo>/` (aquí: <https://geomaticscaminosupm.github.io/web/>). Todos los enlaces son relativos, así que funciona en cualquier ruta o dominio.
4. Solo `404.html` necesita la ruta base: `"baseUrl"` en `data/site.json` (ahora `"/web/"`; usa `"/"` con dominio propio).
5. Dominio propio: añade un fichero `CNAME` en la raíz del repo (el build lo copia a `docs/`) y configúralo en Settings → Pages.
6. Los eventos pasan de "Próximos" a "Pasados" al reconstruir: vuelve a ejecutar `npm run build` y sube `docs/` cuando cambie la fecha.

## Estructura

Todo el contenido es **un fichero Markdown por elemento** en `content/` (personas, proyectos, papers, eventos, conferencias).

```
content/             lines/ people/ projects/ papers/ events/ conferences/ _templates/
data/site.json       Textos generales, socios, ODS, redes
data/i18n.json       Textos de la interfaz y traducciones (es/en/de/fr)
assets/              img/{people,projects,events,logos}, cv/, papers/, css/, js/
src/build.mjs        Generador: valida y escribe docs/ (sitio publicado)
docs/                Sitio generado (NO editar a mano)
guide/STRUCTURE.md   Modelo de datos y todos los campos
guide/ADDING_CONTENT.md  Cómo añadir cada cosa (personas)
AGENTS.md            Instrucciones para agentes de IA
```

**Idiomas:** español (raíz), inglés `/en/`, alemán `/de/`, francés `/fr/`; la primera visita se redirige al idioma del navegador y hay selector en la cabecera. Las traducciones de contenido son ficheros `<id>.<lang>.md` (ver guide/STRUCTURE.md).

**Líneas de investigación:** son contenido editable (`content/lines/`, con foto elegida por el grupo).

**Relaciones:** un *paper* siempre pertenece a uno o más *proyectos*; una *conferencia* siempre pertenece a un *evento*.
Las listas inversas (papers de una persona, conferencias de un evento…) se generan solas.

- Guía para humanos: [guide/ADDING_CONTENT.md](guide/ADDING_CONTENT.md)
- Modelo y campos: [guide/STRUCTURE.md](guide/STRUCTURE.md)
- Guía para agentes de IA: [AGENTS.md](AGENTS.md)

Plantillas listas para copiar en `content/_templates/`. El build valida todo y falla con mensajes claros.

## Notas sobre el contenido actual

- Los proyectos iniciales se han derivado de los servicios, programas de cooperación y cursos de la web antigua; **no incluyen aún fotos ni textos detallados** — conviene ampliarlos.
- No había fotos individuales en la web antigua: las personas muestran iniciales hasta que se añada `photo`.
- Las publicaciones se enlazan al Portal Científico UPM (la web antigua no las listaba).
- La web antigua solo está en español; no hay versión en inglés todavía.
- El logo AGA es blanco, por eso la cabecera es oscura. Revisa permisos de uso de los logos de terceros.
