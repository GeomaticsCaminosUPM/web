# How to add content (humans)

Prerequisite for previewing: Node ≥ 18. No `npm install` needed.

1. **Copy a template** from `content/_templates/` into the right folder and rename it to the new id
   (lowercase-with-hyphens, e.g. `content/people/ana-perez-gomez.md`).
2. **Fill in the fields.** Delete the ones you don't have; only those marked required in
   [STRUCTURE.md](STRUCTURE.md) must stay.
3. **Add files** (photo, CV, PDF, image) to the matching `assets/` folder, using the same file name you wrote in the field.
4. **Check:** `npm run serve` → open <http://localhost:8000>. If something is wrong the build prints exactly which file and field.
5. **Publish:** commit and push to `main`; GitHub Actions deploys.

## Recipes

### New person
Copy `_templates/person.md` → `content/people/<id>.md`. Photo → `assets/img/people/`, CV → `assets/cv/`.
To show them on a project, add their id to that project's `people:`.

### New project
Copy `_templates/project.md` → `content/projects/<id>.md`. Pick `lines:` from `data/site.json` and list `people:` ids.

### New paper (always under a project)
Copy `_templates/paper.md` → `content/papers/<firstauthor-year-keyword>.md`. Set `projects:` to at least one existing
project id. If it doesn't belong to any real project yet, create a project first (e.g. `otras-publicaciones`).

### New event, then conferences in it
1. `content/events/<id>.md` from `_templates/event.md`.
2. For each talk/poster: `content/conferences/<id>.md` from `_templates/conference.md` with `event: <event id>`.

### GIFs and videos
Put the file in `assets/media/` and reference it by name, or use a URL.
- Main video: `video: demo.mp4` or `video: https://www.youtube.com/watch?v=...` in a project, paper, event or conference.
- Cover: `image: demo.gif` (GIFs loop automatically; `.mp4` covers autoplay muted).
- In the text: `![Demo](demo.gif)` or a YouTube/Vimeo link alone on a line.

### Edit / remove
Edit the file. To remove an item delete its file; the build fails if something still points to it, which tells you what to fix.

### New / edited research line
Copy `_templates/line.md` → `content/lines/<id>.md`; put its photo (chosen by the group) in `assets/img/lines/` and set `image:`.
Projects and people then use its id in `lines:` / `interests:`. Deleting a line file fails the build until nothing references it.

### Translate something
Add `content/<kind>/<id>.en.md` (also `.de.md`, `.fr.md`) with just the translated `title`/`summary`/… and body — see
`_templates/translation.md`. Missing translations show the Spanish text. Menu/heading text: `data/i18n.json`.

### New partner, SDG, social link, group-wide text
Edit `data/site.json` (logos in `assets/img/logos/`). Home-page texts in other languages: `data/i18n.json → site`.

### Bulk import of papers
Export from the UPM Portal Científico / ORCID / Zotero as BibTeX or CSV and have an AI agent convert it
(see [../AGENTS.md](../AGENTS.md)); the build validates the result.

## Common errors
| Message | Fix |
|---|---|
| `author "x" looks like a person id but no content/people/x.md exists` | Typo in the id, or an external author: write the full name with spaces/capitals |
| `unknown project id` / `unknown event id` | The referenced file doesn't exist or is misspelled |
| `required field "projects" is empty` | Every paper needs a project; every conference needs an `event` |
| `unknown field` | Field name typo; allowed names are listed in the message |
| `photo not found` / `cv not found` / `pdf not found` | File name doesn't match a file in the `assets/` folder |
