# Content model

The site is generated from **one Markdown file per item** in `content/`. Each file has a YAML-like
header (`---` … `---`) with fields and an optional Markdown body. The file name (without `.md`) is the
item's **id**; ids are lowercase letters/digits separated by hyphens and are used in URLs and to link items.

```
content/
  people/       ana-perez-gomez.md      -> /people/ana-perez-gomez/
  lines/        geodesia.md             -> /lines/geodesia/        (research lines)
  projects/     mi-proyecto.md          -> /projects/mi-proyecto/
  papers/       perez-2025-lidar.md     -> /papers/perez-2025-lidar/
  events/       geo-2025-madrid.md      -> /events/geo-2025-madrid/
  conferences/  perez-2025-geo-lidar.md -> /conferences/perez-2025-geo-lidar/
  _templates/   copy-me examples (ignored by the build)
data/site.json  group-wide settings (texts, partners, SDGs, social links)
data/i18n.json  interface strings + translations of site.json texts (es/en/de/fr)
assets/         img/{people,projects,events,lines,logos}, cv, papers, media
```

## Relations (the rule that keeps everything tidy)

```
person ──< project >── paper        paper  ➜ MUST list ≥1 project   (papers always live under projects)
              │                     conference ➜ MUST name 1 event  (conferences always live under events)
              └──< conference >── event
```

| Item | Points to | Shown automatically on |
|---|---|---|
| project | `people` | person page (projects) |
| paper | `authors` (people), `projects` (required) | each author's page, each project's page, `/papers/` |
| event | – | `/events/`; lists its conferences |
| conference | `authors` (people), `event` (required), `projects` (optional) | each author's page, its event's page, related projects, `/conferences/` |

You only write the link **once, on the "child"** (paper → project, conference → event, project → people).
The reverse listings are generated. Nothing is stored twice.

**Event vs. conference.** An *event* is the occasion (congress, workshop, seminar, course). A *conference*
is a contribution the group made at an event (talk, poster, keynote). One event has many conferences.

**Authors.** Use a person id (`ana-perez-gomez`) for group members so the name links to their profile and
the item shows on it. Write a plain full name (`Jane Doe`) for external co-authors. A slug-looking value that
matches no person file is treated as a typo and fails the build.

## Fields

`*` = required. Unknown fields fail the build (catches typos). Lists use `[a, b]` or a `- item` block.

### people
| Field | Notes |
|---|---|
| `name`*, `surname`* | Given name(s) / surname(s) |
| `position` | e.g. Profesora Titular |
| `group` | Section on the People page (`Investigadores`, `Colaboradores`, `Alumni`…). Order set by `peopleGroups` in `data/site.json` |
| `photo` | File in `assets/img/people/` (square, ~400px). Without it, initials are shown |
| `email`, `web`, `github`, `linkedin`, `scholar` | Contact links |
| `orcid` | Bare id `0000-0002-1825-0097` |
| `cv` | File in `assets/cv/` or full URL |
| `summary` | 1–2 sentence short description |
| `interests` | Research line ids |
| `links` | Extra `Label | URL` lines |
| body | Long biography (Markdown) |

### lines (research lines)
`name`*, `color`* (hex in quotes, e.g. `"#2a9d8f"`), `description`, `image` (`assets/img/lines/`; GIF/mp4 OK),
`order` (home-page position), body = long text. Each line gets a page (`/lines/<id>/`) listing its projects, its
people (those with it in `interests`, plus members of its projects) and the papers of those projects. Lines are
referenced by id from `projects → lines` and `people → interests`; the first line of a project gives its colour.
The coloured stripe under the header is generated from the line colours. Add, rename or delete lines just by editing files.

### projects
`title`*, `summary`, `type`, `status`, `year`, `start`, `end`, `funding`, `image` (`assets/img/projects/`),
`lines` (ids of files in `content/lines/`), `people` (person ids), `web`, `github`, `links`, body = description.

### papers
`title`*, `authors`*, `year`*, `projects`* (≥1), `type`, `venue`, `doi` (bare or URL), `url`,
`pdf` (`assets/papers/` or URL), `abstract`, `links`, body.

### events
`title`*, `date`* (`YYYY-MM-DD`), `endDate`, `type`, `location`, `summary`, `image` (`assets/img/events/`),
`url`, `links`, body. Future events appear under "Próximos" (the site rebuilds daily, so this updates itself).

### conferences
`title`*, `authors`*, `event`* (event id), `type`, `date` (defaults to the event's), `projects`, `url`,
`slides` (`assets/papers/` or URL), `abstract`, `links`, body.

### Images, GIFs and videos
- **Cover images** (`image` on projects/events) may be `.jpg/.png/.gif/.webp` or even `.mp4/.webm`.
  **GIFs loop automatically** (that is how browsers play them). `.mp4`/`.webm` autoplay muted in a loop.
- **`video`** (projects, papers, events, conferences): a file in `assets/media/`, or a URL — YouTube, Vimeo
  (embedded, autoplay muted + loop) or a direct `.mp4/.webm` link. Shown at the top of the detail page.
- **In a body**, put media on its own line:
  `![description](clip.gif)` (file in `assets/media/` or a full URL; `.mp4`/`.webm` too), or just paste a
  YouTube/Vimeo/`.mp4` URL alone on a line to embed it.
- Browsers only allow autoplay when the video is **muted**; users can unmute with the controls. Keep files small
  (GitHub Pages limit: 1 GB site, 100 MB per file; prefer < 10 MB — compress or host on YouTube).

### Languages / translations
The site is built in **Spanish (default, root URLs), English, German and French** (`/en/`, `/de/`, `/fr/`).
- **Main file = Spanish.** To translate an item add `content/<kind>/<id>.<lang>.md` (`lang` = `en|de|fr`) containing only the
  translatable frontmatter fields (`title`, `name`, `summary`, `description`, `position`, `type`, `status`, `funding`,
  `location`, `abstract`) and, if wanted, the translated body. Anything not translated **falls back to Spanish**.
  Names, dates, ids, links, DOIs, venues and files are shared across languages and never repeated.
- **Interface text** (menus, buttons, headings) and the home texts (`tagline`, `intro`, `mission`, SDG names) are in
  `data/i18n.json`. Add a language by adding it to `languages` and a column to every `ui` key.
- **Language choice:** a visitor's first visit to a Spanish page is redirected to the language of their browser
  (English if their language isn't offered); the EN/DE/FR/ES switcher in the header overrides and remembers the choice.
- Translations are static files (not live machine translation): they are authored by people or by an AI agent
  (see [../AGENTS.md](../AGENTS.md)). `_templates/translation.md` shows the format.

### links format
`Label | https://url` — one per line under `links:`.

### Markdown in bodies
Paragraphs, `#`/`##`/`###` headings, `- ` lists, `**bold**`, `*italic*`, `[text](url)`. Raw HTML is escaped.

### Research lines
Defined in `data/site.json → researchLines` (`id`, `name`, `color`, `description`). 
