// Static site generator for the AGA website. Zero dependencies (Node >= 18).
// Usage: node src/build.mjs   -> reads ./content + ./data, writes ./docs
// Data model and rules: guide/STRUCTURE.md
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'docs'); // GitHub Pages serves this folder (Settings → Pages → Deploy from a branch → main /docs)
const SITE = JSON.parse(readFileSync(join(ROOT, 'data/site.json'), 'utf8'));
const I18N = JSON.parse(readFileSync(join(ROOT, 'data/i18n.json'), 'utf8'));
let site = SITE, LANG = 'es', curRel = null;

// ---------------------------------------------------------------- schema
// req = required keys, list = keys that hold lists, all other keys are scalars.
// Unknown keys are rejected so typos never silently disappear.
const SCHEMA = {
  people: { req: ['name', 'surname'], scalar: ['name', 'surname', 'position', 'group', 'photo', 'email', 'orcid', 'web', 'github', 'linkedin', 'scholar', 'cv', 'summary'], list: ['interests', 'links'] },
  lines: { req: ['name', 'color'], scalar: ['name', 'color', 'description', 'order', 'image'], list: [] },
  projects: { req: ['title'], scalar: ['video', 'title', 'summary', 'type', 'status', 'year', 'start', 'end', 'image', 'funding', 'web', 'github'], list: ['lines', 'people', 'links'] },
  papers: { req: ['title', 'authors', 'year', 'projects'], scalar: ['video', 'title', 'year', 'type', 'venue', 'doi', 'url', 'pdf', 'abstract'], list: ['authors', 'projects', 'links'] },
  events: { req: ['title', 'date'], scalar: ['video', 'title', 'date', 'endDate', 'type', 'location', 'url', 'image', 'summary'], list: ['links'] },
  conferences: { req: ['title', 'authors', 'event'], scalar: ['video', 'title', 'event', 'type', 'date', 'url', 'slides', 'abstract'], list: ['authors', 'projects', 'links'] },
};
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const errors = [];
const err = (m) => errors.push(m);

// ---------------------------------------------------------------- parsing
const unquote = (v) => v.replace(/^(["'])(.*)\1$/, '$2');
function parseFrontmatter(text, where) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---[ \t]*\n?([\s\S]*)$/);
  if (!m) { err(`${where}: missing "---" frontmatter block`); return { data: {}, body: '' }; }
  const data = {}, lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim() || l.trim().startsWith('#')) continue;
    const kv = l.match(/^([A-Za-z][\w]*):\s*(.*)$/);
    if (!kv) { err(`${where}: cannot parse line "${l}" (expected "key: value")`); continue; }
    const [, key, raw] = kv;
    let v = raw.trim();
    if (v === '') {                                   // block list
      const items = [];
      while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) items.push(unquote(lines[++i].replace(/^\s+-\s+/, '').trim()));
      data[key] = items.length ? items : '';
    } else if (v.startsWith('[') && v.endsWith(']')) { // inline list
      data[key] = v.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean);
    } else data[key] = unquote(v);
  }
  return { data, body: m[2].trim() };
}

const TR_FIELDS = ['title', 'name', 'summary', 'description', 'position', 'type', 'status', 'funding', 'location', 'abstract'];
function load(kind) {
  const dir = join(ROOT, 'content', kind), spec = SCHEMA[kind];
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort();
  const items = [], trans = [];
  for (const f of files) {
    const tm = f.match(/^(.+)\.(en|de|fr)\.md$/);
    if (tm) { trans.push({ f, id: tm[1], lang: tm[2] }); continue; }
    const id = f.slice(0, -3), where = `content/${kind}/${f}`;
    if (!ID_RE.test(id)) err(`${where}: file name must be lowercase-with-hyphens (a-z, 0-9, -)`);
    const { data, body } = parseFrontmatter(readFileSync(join(dir, f), 'utf8'), where);
    for (const k of Object.keys(data)) {
      if (!spec.scalar.includes(k) && !spec.list.includes(k)) err(`${where}: unknown field "${k}" (allowed: ${[...spec.scalar, ...spec.list].join(', ')})`);
      else if (spec.list.includes(k) && !Array.isArray(data[k]) && data[k] !== '') data[k] = [data[k]];
      else if (spec.scalar.includes(k) && Array.isArray(data[k])) err(`${where}: "${k}" must be a single value, not a list`);
    }
    for (const k of spec.req) if (!data[k] || (Array.isArray(data[k]) && !data[k].length)) err(`${where}: required field "${k}" is empty`);
    for (const k of spec.list) if (!Array.isArray(data[k])) data[k] = [];
    items.push({ id, kind, ...data, body, where });
  }
  // Translation files: <id>.<en|de|fr>.md may override TR_FIELDS and the body.
  const byid = Object.fromEntries(items.map((i) => [i.id, i]));
  for (const { f, id, lang } of trans) {
    const where = `content/${kind}/${f}`, it = byid[id];
    if (!it) { err(`${where}: no matching content/${kind}/${id}.md`); continue; }
    const { data, body } = parseFrontmatter(readFileSync(join(dir, f), 'utf8'), where);
    for (const k of Object.keys(data)) if (!TR_FIELDS.includes(k) || !spec.scalar.includes(k)) err(`${where}: field "${k}" cannot be translated (translatable here: ${TR_FIELDS.filter((x) => spec.scalar.includes(x)).join(', ')})`);
    (it.i18n ||= {})[lang] = { ...data, body };
  }
  return items;
}

const RAW = { lines: load('lines'), people: load('people'), projects: load('projects'), papers: load('papers'), events: load('events'), conferences: load('conferences') };
let { lines, people, projects, papers, events, conferences } = RAW;

// ---------------------------------------------------------------- validation of relations
const idsOf = (a) => new Set(a.map((x) => x.id));
const personIds = idsOf(people), projectIds = idsOf(projects), eventIds = idsOf(events), lineIds = idsOf(lines);
const fileExists = (rel) => existsSync(join(ROOT, rel));
const isUrl = (s) => /^https?:\/\//.test(s);
const date = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

for (const l of lines) if (l.image && !fileExists(`assets/img/lines/${l.image}`)) err(`${l.where}: image not found at assets/img/lines/${l.image}`);
for (const l of lines) if (!/^#[0-9a-fA-F]{6}$/.test(l.color)) err(`${l.where}: color must be a hex value like "#e4572e" (in quotes)`);
for (const p of people) {
  for (const i of p.interests) if (!lineIds.has(i)) err(`${p.where}: unknown research line "${i}"`);
  if (p.photo && !fileExists(`assets/img/people/${p.photo}`)) err(`${p.where}: photo not found at assets/img/people/${p.photo}`);
  if (p.cv && !isUrl(p.cv) && !fileExists(`assets/cv/${p.cv}`)) err(`${p.where}: cv not found at assets/cv/${p.cv} (or use a full URL)`);
  if (p.email && !/^\S+@\S+\.\S+$/.test(p.email)) err(`${p.where}: invalid email`);
  if (p.orcid && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(p.orcid)) err(`${p.where}: orcid must look like 0000-0002-1825-0097`);
}
for (const p of projects) {
  for (const l of p.lines) if (!lineIds.has(l)) err(`${p.where}: unknown research line "${l}"`);
  for (const x of p.people) if (!personIds.has(x)) err(`${p.where}: unknown person id "${x}"`);
  if (p.image && !fileExists(`assets/img/projects/${p.image}`)) err(`${p.where}: image not found at assets/img/projects/${p.image}`);
}
// Authors: a person id (links to their page) or a plain name (external author).
// Anything slug-shaped that is not a known person is treated as a typo.
const checkAuthors = (it) => { for (const a of it.authors) if (ID_RE.test(a) && !personIds.has(a)) err(`${it.where}: author "${a}" looks like a person id but no content/people/${a}.md exists (external authors: write the full name, e.g. "Jane Doe")`); };
for (const p of papers) {
  checkAuthors(p);
  for (const x of p.projects) if (!projectIds.has(x)) err(`${p.where}: unknown project id "${x}" (every paper must belong to at least one project)`);
  if (p.pdf && !isUrl(p.pdf) && !fileExists(`assets/papers/${p.pdf}`)) err(`${p.where}: pdf not found at assets/papers/${p.pdf} (or use a full URL)`);
  if (p.year && !/^\d{4}$/.test(p.year)) err(`${p.where}: year must be 4 digits`);
}
for (const e of events) {
  if (!date(e.date)) err(`${e.where}: date must be YYYY-MM-DD`);
  if (e.endDate && !date(e.endDate)) err(`${e.where}: endDate must be YYYY-MM-DD`);
  if (e.image && !fileExists(`assets/img/events/${e.image}`)) err(`${e.where}: image not found at assets/img/events/${e.image}`);
}
for (const c of conferences) {
  checkAuthors(c);
  if (!eventIds.has(c.event)) err(`${c.where}: unknown event id "${c.event}" (every conference must belong to an event)`);
  for (const x of c.projects) if (!projectIds.has(x)) err(`${c.where}: unknown project id "${x}"`);
  if (c.date && !date(c.date)) err(`${c.where}: date must be YYYY-MM-DD`);
  if (c.slides && !isUrl(c.slides) && !fileExists(`assets/papers/${c.slides}`)) err(`${c.where}: slides not found at assets/papers/${c.slides} (or use a full URL)`);
}
for (const x of [...projects, ...papers, ...events, ...conferences]) {
  if (x.video && !isUrl(x.video) && !fileExists(`assets/media/${x.video}`)) err(`${x.where}: video not found at assets/media/${x.video} (or use a YouTube/Vimeo/mp4 URL)`);
}
for (const x of [...people, ...projects, ...papers, ...events, ...conferences]) for (const m of x.body.matchAll(/^!\[[^\]]*\]\(([^)\s]+)\)$/gm)) if (!isUrl(m[1]) && !fileExists(`assets/media/${m[1]}`)) err(`${x.where}: media not found at assets/media/${m[1]}`);
for (const x of [...people, ...projects, ...papers, ...events, ...conferences]) for (const l of x.links || []) if (!/^[^|]+\|\s*https?:\/\/\S+$/.test(l)) err(`${x.where}: link "${l}" must be "Label | https://url"`);
if (errors.length) { console.error('Build failed:\n - ' + errors.join('\n - ')); process.exit(1); }

// ---------------------------------------------------------------- helpers
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lineOf = (id) => lines.find((l) => l.id === id);
const byId = (a) => Object.fromEntries(a.map((x) => [x.id, x]));
let P = byId(people), PR = byId(projects), EV = byId(events);
// ---- i18n: UI strings live in data/i18n.json; content translations in content/<kind>/<id>.<lang>.md
const t = (key, vars = {}) => { let x = I18N.ui[key]?.[LANG] ?? I18N.ui[key]?.es ?? key; for (const [k, v] of Object.entries(vars)) x = x.replaceAll(`{${k}}`, v); return x; };
const tg = (g) => I18N.ui['group.' + g]?.[LANG] ?? g;
const loc = (it) => { const tr = it.i18n?.[LANG]; if (!tr) return it; const o = { ...it }; for (const k of TR_FIELDS) if (tr[k]) o[k] = tr[k]; if (tr.body) o.body = tr.body; return o; };
function setLang(l) {
  LANG = l;
  lines = RAW.lines.map(loc).sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999) || a.name.localeCompare(b.name, 'es'));
  people = RAW.people.map(loc); projects = RAW.projects.map(loc); papers = RAW.papers.map(loc); events = RAW.events.map(loc); conferences = RAW.conferences.map(loc);
  P = byId(people); PR = byId(projects); EV = byId(events);
  const tr = I18N.site[l] || {};
  site = { ...SITE, ...['tagline', 'intro', 'mission'].reduce((o, k) => (tr[k] ? { ...o, [k]: tr[k] } : o), {}), sdgs: SITE.sdgs.map((s) => ({ ...s, name: tr.sdgs?.[s.n] || s.name })) };
}
setLang('es');
const fullName = (p) => `${p.name} ${p.surname}`;
const initials = (p) => (p.name[0] + p.surname[0]).toUpperCase();
const today = new Date().toISOString().slice(0, 10);
const fmtDate = (s) => (s ? new Date(s + 'T12:00:00Z').toLocaleDateString(LANG === 'es' ? 'es-ES' : LANG, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
const dateRange = (e) => (e.endDate && e.endDate !== e.date ? `${fmtDate(e.date)} – ${fmtDate(e.endDate)}` : fmtDate(e.date));
const splitLink = (l) => { const i = l.indexOf('|'); return { label: l.slice(0, i).trim(), url: l.slice(i + 1).trim() }; };
const doiUrl = (d) => (d ? (isUrl(d) ? d : `https://doi.org/${d}`) : '');
const asset = (dir, f) => (isUrl(f) ? f : `assets/${dir}/${f}`);

// ---- media: GIFs loop natively as <img>; mp4/webm autoplay muted in a loop; YouTube/Vimeo are embedded.
const VIDEO_FILE = /\.(mp4|webm|ogv|mov)(\?.*)?$/i;
function embedUrl(u) {
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&mute=1&loop=1&playlist=${m[1]}&playsinline=1`;
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}?autoplay=1&muted=1&loop=1&playsinline=1`;
  return '';
}
const isVideoRef = (u) => VIDEO_FILE.test(u) || !!embedUrl(u);
// src may be a full URL, or a path already prefixed with the page root.
function media(src, alt = '') {
  if (!isUrl(src) || !embedUrl(src)) {
    if (VIDEO_FILE.test(src)) return `<video src="${esc(src)}" autoplay muted loop playsinline controls preload="metadata"></video>`;
    return `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`; // .gif loops by itself
  }
  return `<iframe src="${esc(embedUrl(src))}" title="${t('video')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`;
}
const mediaSrc = (f, root) => (isUrl(f) ? f : `${root}assets/media/${f}`);
const mediaBlock = (f, root, alt) => (f ? `<figure class="media ${isVideoRef(f) ? 'video' : ''}">${media(mediaSrc(f, root), alt)}</figure>` : '');

// Minimal markdown: #/##/### headings, paragraphs, "- " lists, **bold**, *italic*, [text](url).
function md(text, root = '../../') {
  if (!text) return '';
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  return text.split(/\n\s*\n/).map((b) => {
    const ls = b.split('\n');
    const im = b.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);   // ![alt](file.gif | file.mp4 | https://…)
    if (im) return mediaBlock(im[2], root, im[1]);
    if (/^https?:\/\/\S+$/.test(b.trim()) && isVideoRef(b.trim())) return mediaBlock(b.trim(), root);   // bare video URL on its own line
    const h = b.match(/^(#{1,3})\s+(.*)$/);
    if (h && ls.length === 1) return `<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`;
    if (ls.every((l) => /^\s*[-*]\s+/.test(l))) return `<ul>${ls.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
    return `<p>${inline(ls.join(' '))}</p>`;
  }).join('\n');
}

const tag = (id) => { const l = lineOf(id); return `<span class="tag" style="--c:${l.color}">${esc(l.name)}</span>`; };
const authorsHtml = (list, root) => list.map((a) => (P[a] ? `<a href="${root}people/${a}/">${esc(fullName(P[a]))}</a>` : esc(a))).join(', ');
const projTags = (ids, root) => ids.map((i) => `<a class="chip" href="${root}projects/${i}/">${esc(PR[i].title)}</a>`).join('');
const linksList = (links) => (links.length ? `<ul class="linklist">${links.map(splitLink).map((l) => `<li><a href="${esc(l.url)}" rel="noopener">${esc(l.label)}</a></li>`).join('')}</ul>` : '');

// relations
const papersOf = (pred) => papers.filter(pred).sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
const confsOf = (pred) => conferences.filter(pred).sort((a, b) => (b.date || EV[b.event].date).localeCompare(a.date || EV[a.event].date));
const projectsOfPerson = (id) => projects.filter((p) => p.people.includes(id)).sort(projectSort);
function projectSort(a, b) { return (b.year || b.start || '0').toString().localeCompare((a.year || a.start || '0').toString()) || a.title.localeCompare(b.title); }

// ---------------------------------------------------------------- components
function layout({ title, root, active, body, description }) {
  const items = [['', t('nav.home'), 'home'], ['projects/', t('nav.projects'), 'projects'], ['papers/', t('nav.papers'), 'papers'], ['events/', t('nav.events'), 'events'], ['conferences/', t('nav.conferences'), 'conferences'], ['people/', t('nav.people'), 'people']];
  const nav = items.map(([h, l, k]) => `<a href="${root}${h}"${active === k ? ' aria-current="page"' : ''}>${l}</a>`).join('');
  // language switcher: same page in every language; auto-detect redirect on first visit (Spanish pages only)
  const distRoot = (LANG === 'es' ? '' : '../') + root, relDir = curRel ? curRel.replace(/index\.html$/, '') : '';
  const alt = (c) => distRoot + (c === 'es' ? '' : c + '/') + relDir;
  const switcher = curRel === null ? '' : `<div class="lang" role="group" aria-label="Language">${I18N.languages.map((l) => `<a href="${alt(l.code)}" hreflang="${l.code}" lang="${l.code}" data-lang="${l.code}" title="${esc(l.name)}"${l.code === LANG ? ' aria-current="true"' : ''}>${l.label}</a>`).join('')}</div>`;
  const detect = curRel !== null && LANG === 'es' ? `<script>(function(){try{if(localStorage.getItem('lang'))return;var A={${I18N.languages.filter((l) => l.code !== 'es').map((l) => `${l.code}:${JSON.stringify(alt(l.code))}`).join(',')}},p=(navigator.languages||[navigator.language||'']);for(var i=0;i<p.length;i++){var c=(p[i]||'').slice(0,2).toLowerCase();if(c==='es')return;if(A[c]){location.replace(A[c]);return}}location.replace(A.en)}catch(e){}})()</script>` : '';
  const stripe = lines.length ? `<div class="stripe" aria-hidden="true" style="background:linear-gradient(90deg,${lines.map((l, i) => `${l.color} ${(i * 100 / lines.length).toFixed(2)}% ${((i + 1) * 100 / lines.length).toFixed(2)}%`).join(',')})"></div>` : '';
  return `<!doctype html>
<html lang="${LANG}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(site.name)} UPM</title>
<meta name="description" content="${esc(description || site.intro)}">
${detect}<link rel="stylesheet" href="${root}assets/css/style.css">
</head><body>
<header class="top"><div class="wrap">
<a class="brand" href="${root}"><img src="${root}assets/img/logos/aga.png" alt="${esc(site.fullName)} – ${esc(site.university)}"></a>
<nav>${nav}<a href="mailto:${esc(site.email)}" class="contact">${t('nav.contact')}</a>${switcher}</nav>
</div></header>
<main>${body}</main>
<footer><div class="wrap">
<div><strong>${esc(site.fullName)}</strong><br>${esc(site.university)}<br>${site.schools.map((s) => esc(s.name)).join('<br>')}<br><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></div>
<ul class="social">${site.social.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul>
<svg class="compass" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="currentColor"><circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="30" stroke-dasharray="2 3"/><path d="M50 2v96M2 50h96M16 16l68 68M84 16L16 84" stroke-width=".6"/></g><path d="M50 6l7 37 37 7-37 7-7 37-7-37-37-7 37-7z" fill="currentColor" opacity=".85"/><text x="50" y="-2" text-anchor="middle" font-size="9" font-family="monospace" fill="currentColor" transform="translate(0 12)">N</text></svg>
<div class="small">ETRS89 · UTM 30N · 1:25 000 · © ${new Date().getFullYear()} AGA UPM · <a href="${esc(site.graphicIdentityUrl)}" rel="noopener">${t('footer.identity')}</a></div>
</div></footer>
<script src="${root}assets/js/filter.js"></script>
</body></html>`;
}

const thumb = (src, extra = '') => `<div class="thumb ${extra}">${src ? media(src) : ''}</div>`;
const searchBox = (ph) => `<input id="q" type="search" placeholder="${esc(ph)}" aria-label="${esc(ph)}">`;
const lineFilters = () => `<div class="filters" role="group" aria-label="${t('filters.aria')}"><b class="legend-title">${t('legend')}</b><button class="on" data-filter="">${t('all')}</button>${lines.map((l) => `<button data-filter="${l.id}" style="--c:${l.color}">${esc(l.name)}</button>`).join('')}</div>`;
const section = (title, inner, extra = '') => (inner ? `<section class="js-sec"><h2>${title}</h2>${extra}${inner}</section>` : '');

function projectCard(pr, root) {
  return `<a class="card item" href="${root}projects/${pr.id}/" data-lines="${pr.lines.join(' ')}">
${thumb(pr.image && `${root}assets/img/projects/${esc(pr.image)}`)}
<div class="card-body"><div class="tags">${pr.lines.map(tag).join('')}</div><h3>${esc(pr.title)}</h3><p>${esc(pr.summary || '')}</p>
<div class="meta">${esc([pr.type, pr.status].filter(Boolean).join(' · '))}${pr.year ? ` <span class="spot">${esc(pr.year)}</span>` : ''}</div></div></a>`;
}
function personCard(p, root) {
  const av = p.photo ? `<img src="${root}assets/img/people/${esc(p.photo)}" alt="" loading="lazy">` : `<span>${esc(initials(p))}</span>`;
  return `<li class="person item" data-lines="${p.interests.join(' ')}"><a class="avatar" href="${root}people/${p.id}/">${av}</a><div><h3><a href="${root}people/${p.id}/">${esc(fullName(p))}</a></h3><p>${esc(p.position || tg(p.group || 'Otros'))}</p></div></li>`;
}
function paperItem(p, root) {
  const links = [p.doi && `<a href="${esc(doiUrl(p.doi))}" rel="noopener">DOI</a>`, p.url && `<a href="${esc(p.url)}" rel="noopener">${t('link')}</a>`, p.pdf && `<a href="${root}${esc(asset('papers', p.pdf))}">PDF</a>`].filter(Boolean).join(' · ');
  return `<li class="entry item" data-lines="${p.projects.flatMap((i) => PR[i].lines).join(' ')}"><h3><a href="${root}papers/${p.id}/">${esc(p.title)}</a></h3>
<p class="authors">${authorsHtml(p.authors, root)}</p><p class="meta">${esc([p.venue, p.year, p.type].filter(Boolean).join(' · '))}${links ? ' · ' + links : ''}</p>
<div class="chips">${projTags(p.projects, root)}</div></li>`;
}
function confItem(c, root) {
  const ev = EV[c.event], d = c.date || ev.date;
  return `<li class="entry item"><h3><a href="${root}conferences/${c.id}/">${esc(c.title)}</a></h3>
<p class="authors">${authorsHtml(c.authors, root)}</p><p class="meta">${esc([c.type, fmtDate(d)].filter(Boolean).join(' · '))} · <a href="${root}events/${ev.id}/">${esc(ev.title)}</a>${c.slides ? ` · <a href="${root}${esc(asset('papers', c.slides))}">Slides</a>` : ''}</p>
${c.projects.length ? `<div class="chips">${projTags(c.projects, root)}</div>` : ''}</li>`;
}
function eventCard(e, root) {
  const n = conferences.filter((c) => c.event === e.id).length;
  return `<a class="card item" href="${root}events/${e.id}/">${thumb(e.image && `${root}assets/img/events/${esc(e.image)}`)}
<div class="card-body"><div class="meta">${esc(dateRange(e))}</div><h3>${esc(e.title)}</h3><p>${esc(e.summary || '')}</p>
<div class="meta">${e.location ? `<span class="pin"></span>${esc(e.location)}` : ''}${e.type ? ` · ${esc(e.type)}` : ''}${n ? ` · ${t(n > 1 ? 'contrib.many' : 'contrib.one', { n })}` : ''}</div></div></a>`;
}
const lineTile = (l, root) => `<a class="line" style="--c:${l.color}" href="${root}lines/${l.id}/">${thumb(l.image && `${root}assets/img/lines/${esc(l.image)}`)}<div class="line-body"><h3>${esc(l.name)}</h3><p>${esc(l.description || '')}</p><span>${t('home.seeLineProjects')}</span></div></a>`;
const yearGroups = (items, getYear, render) => {
  const years = [...new Set(items.map(getYear))].sort((a, b) => b - a);
  return years.map((y) => `<section class="js-sec"><h2>${y}</h2><ul class="entries">${items.filter((i) => getYear(i) === y).map(render).join('')}</ul></section>`).join('');
};

function write(rel, html) {
  const f = join(DIST, LANG === 'es' ? '' : LANG, rel);
  mkdirSync(dirname(f), { recursive: true });
  // non-default languages live in /<lang>/ while assets are shared at the site root: add one "../"
  writeFileSync(f, LANG === 'es' ? html : html.replace(/((?:href|src)=")((?:\.\.\/)*)assets\//g, '$1../$2assets/'));
}
const page = (rel, o) => { curRel = rel; write(rel, layout(o)); curRel = null; };

// ---------------------------------------------------------------- build
rmSync(DIST, { recursive: true, force: true });
cpSync(join(ROOT, 'assets'), join(DIST, 'assets'), { recursive: true });

function buildLang() {
const groupOrder = [...(site.peopleGroups || []), ...[...new Set(people.map((p) => p.group || 'Otros'))].filter((g) => !(site.peopleGroups || []).includes(g)).sort()];
const sortedPeople = [...people].sort((a, b) => a.surname.localeCompare(b.surname, 'es') || a.name.localeCompare(b.name, 'es'));
const sortedProjects = [...projects].sort(projectSort);
const sortedEvents = [...events].sort((a, b) => b.date.localeCompare(a.date));
const allPapers = papersOf(() => true), allConfs = confsOf(() => true);

// Home
const upcoming = events.filter((e) => (e.endDate || e.date) >= today).sort((a, b) => a.date.localeCompare(b.date));
const homeEvents = (upcoming.length ? upcoming : sortedEvents).slice(0, 3);
page('index.html', { title: t('nav.home'), root: '', active: 'home', body: `
<section class="hero"><div class="wrap">
<p class="eyebrow"><span class="coord">${esc(site.coordinates || '')}</span> ${esc(site.university)}</p><h1>${esc(site.tagline)}</h1><p class="lead">${esc(site.intro)}</p>
<p><a class="btn" href="projects/">${t('home.seeProjects')}</a> <a class="btn ghost" href="people/">${t('home.meetTeam')}</a></p></div>
<svg class="north" viewBox="0 0 60 84" aria-hidden="true"><circle cx="30" cy="46" r="26" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 3"/><path d="M30 6 L42 52 L30 44 L18 52Z" fill="currentColor"/><path d="M30 6 L30 44 L18 52Z" fill="#fff"/><path d="M30 6 L42 52 L30 44Z" fill="none" stroke="currentColor"/><text x="30" y="82" text-anchor="middle" font-family="monospace" font-size="11" fill="currentColor">N</text></svg>
<div class="scalebar" aria-hidden="true"><i></i><i></i><i></i><i></i><span style="left:0">0</span><span style="left:50%">5</span><span style="left:100%">10 km</span></div></section>
<section class="wrap"><div class="row"><h2>${t('home.lines')}</h2><a href="lines/">${t('home.all')}</a></div><div class="lines">${lines.map((l) => lineTile(l, '')).join('')}</div></section>
<section class="wrap about"><div><h2>${t('home.mission')}</h2><p>${esc(site.mission)}</p><p><a href="${esc(site.social.at(-1).url)}" rel="noopener">${t('home.science')}</a></p></div>
${fileExists('assets/img/group.jpg') ? `<img src="assets/img/group.jpg" alt="${t('home.teamAlt')}" loading="lazy">` : ''}</section>
<section class="wrap"><div class="row"><h2>${t('home.recentProjects')}</h2><a href="projects/">${t('home.all')}</a></div><div class="grid">${sortedProjects.slice(0, 6).map((p) => projectCard(p, '')).join('')}</div></section>
${homeEvents.length ? `<section class="wrap"><div class="row"><h2>${upcoming.length ? t('home.upcomingEvents') : t('home.recentEvents')}</h2><a href="events/">${t('home.all')}</a></div><div class="grid">${homeEvents.map((e) => eventCard(e, '')).join('')}</div></section>` : ''}
${allPapers.length ? `<section class="wrap"><div class="row"><h2>${t('home.latestPapers')}</h2><a href="papers/">${t('home.all')}</a></div><ul class="entries">${allPapers.slice(0, 5).map((p) => paperItem(p, '')).join('')}</ul></section>` : ''}
<section class="wrap"><div class="row"><h2>${t('home.team')}</h2><a href="people/">${t('home.seePeople')}</a></div>
${groupOrder.map((g) => { const l = sortedPeople.filter((p) => (p.group || 'Otros') === g); return l.length ? `<h3 class="sub">${esc(tg(g))}</h3><ul class="people">${l.map((p) => personCard(p, '')).join('')}</ul>` : ''; }).join('')}</section>
<section class="wrap"><h2>${t('home.partners')}</h2><ul class="logos">${site.partners.map((p) => `<li><a href="${esc(p.url)}" rel="noopener" title="${esc(p.name)}"><img src="assets/img/logos/${esc(p.logo)}" alt="${esc(p.name)}" loading="lazy"></a></li>`).join('')}</ul>
<h2>${t('home.sdgs')}</h2><ul class="logos sdg">${site.sdgs.map((s) => `<li><a href="${esc(s.url)}" rel="noopener" title="${t('sdg')} ${s.n}: ${esc(s.name)}"><img src="assets/img/logos/${esc(s.logo)}" alt="${t('sdg')} ${s.n}: ${esc(s.name)}" loading="lazy"></a></li>`).join('')}</ul></section>` });

// Research lines
page('lines/index.html', { title: t('nav.lines'), root: '../', active: '', body: `
<section class="wrap pagehead"><h1>${t('nav.lines')}</h1><p class="lead">${t('lines.lead')}</p></section>
<section class="wrap"><div class="lines">${lines.map((l) => lineTile(l, '../')).join('')}</div></section>` });
for (const l of lines) {
  const prs = sortedProjects.filter((p) => p.lines.includes(l.id)), pids = new Set(prs.map((p) => p.id));
  const ppl = sortedPeople.filter((p) => p.interests.includes(l.id) || prs.some((pr) => pr.people.includes(p.id)));
  const ps = papersOf((x) => x.projects.some((i) => pids.has(i)));
  page(`lines/${l.id}/index.html`, { title: l.name, root: '../../', active: '', description: l.description, body: `
<section class="wrap detail"><p><a href="../">${t('back.lines')}</a></p><h1 style="color:${l.color}">${esc(l.name)}</h1>
${l.description ? `<p class="lead">${esc(l.description)}</p>` : ''}${l.image ? thumb(`../../assets/img/lines/${esc(l.image)}`, 'big') : ''}<div class="prose">${md(l.body)}</div>
${section(t('nav.projects'), prs.length ? `<div class="grid">${prs.map((p) => projectCard(p, '../../')).join('')}</div>` : '')}
${section(t('nav.people'), ppl.length ? `<ul class="people">${ppl.map((p) => personCard(p, '../../')).join('')}</ul>` : '')}
${section(t('nav.papers'), ps.length ? `<ul class="entries">${ps.map((p) => paperItem(p, '../../')).join('')}</ul>` : '')}</section>` });
}

// Projects
page('projects/index.html', { title: t('nav.projects'), root: '../', active: 'projects', body: `
<section class="wrap pagehead"><h1>${t('nav.projects')}</h1><p class="lead">${t('projects.lead')}</p>${searchBox(t('projects.search'))}${lineFilters()}</section>
<section class="wrap"><div class="grid">${sortedProjects.map((p) => projectCard(p, '../')).join('')}</div><p class="empty" hidden>${t('noresults')}</p></section>` });
for (const pr of projects) {
  const team = pr.people.map((i) => P[i]), ps = papersOf((p) => p.projects.includes(pr.id)), cs = confsOf((c) => c.projects.includes(pr.id));
  const facts = [[t('fact.type'), pr.type], [t('fact.status'), pr.status], [t('fact.year'), pr.year], [t('fact.start'), pr.start], [t('fact.end'), pr.end], [t('fact.funding'), pr.funding]].filter(([, v]) => v);
  const ext = [pr.web && { label: t('projectWeb'), url: pr.web }, pr.github && { label: 'GitHub', url: pr.github }, ...pr.links.map(splitLink)].filter(Boolean);
  page(`projects/${pr.id}/index.html`, { title: pr.title, root: '../../', active: 'projects', description: pr.summary, body: `
<section class="wrap detail"><p><a href="../">${t('back.projects')}</a></p><div class="tags">${pr.lines.map(tag).join('')}</div><h1>${esc(pr.title)}</h1>
${pr.summary ? `<p class="lead">${esc(pr.summary)}</p>` : ''}
${pr.image ? thumb(`../../assets/img/projects/${esc(pr.image)}`, 'big') : ''}${mediaBlock(pr.video, '../../')}
${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
<div class="prose">${md(pr.body)}</div>
${ext.length ? `<ul class="linklist">${ext.map((l) => `<li><a href="${esc(l.url)}" rel="noopener">${esc(l.label)}</a></li>`).join('')}</ul>` : ''}
${section(t('nav.people'), team.length ? `<ul class="people">${team.map((p) => personCard(p, '../../')).join('')}</ul>` : '')}
${section(t('nav.papers'), ps.length ? `<ul class="entries">${ps.map((p) => paperItem(p, '../../')).join('')}</ul>` : '')}
${section(t('nav.conferences'), cs.length ? `<ul class="entries">${cs.map((c) => confItem(c, '../../')).join('')}</ul>` : '')}
</section>` });
}

// People
page('people/index.html', { title: t('nav.people'), root: '../', active: 'people', body: `
<section class="wrap pagehead"><h1>${t('nav.people')}</h1><p class="lead">${t('people.lead')}</p>${searchBox(t('people.search'))}</section>
${groupOrder.map((g) => { const l = sortedPeople.filter((p) => (p.group || 'Otros') === g); return l.length ? `<section class="wrap js-sec"><h2>${esc(tg(g))}</h2><ul class="people">${l.map((p) => personCard(p, '../')).join('')}</ul></section>` : ''; }).join('')}
<p class="wrap empty" hidden>${t('noresults')}</p>` });
for (const p of people) {
  const contact = [
    p.email && ['Email', `mailto:${p.email}`], p.orcid && ['ORCID', `https://orcid.org/${p.orcid}`], p.web && ['Web', p.web], p.github && ['GitHub', p.github],
    p.linkedin && ['LinkedIn', p.linkedin], p.scholar && ['Google Scholar', p.scholar], p.cv && ['CV', asset('cv', p.cv)], ...p.links.map(splitLink).map((l) => [l.label, l.url]),
  ].filter(Boolean).map(([l, u]) => [l, isUrl(u) || u.startsWith('mailto:') ? u : `../../${u}`]);
  const prs = projectsOfPerson(p.id), ps = papersOf((x) => x.authors.includes(p.id)), cs = confsOf((x) => x.authors.includes(p.id));
  const av = p.photo ? `<img src="../../assets/img/people/${esc(p.photo)}" alt="${esc(fullName(p))}">` : `<span>${esc(initials(p))}</span>`;
  page(`people/${p.id}/index.html`, { title: fullName(p), root: '../../', active: 'people', description: p.summary, body: `
<section class="wrap detail"><p><a href="../">${t('back.people')}</a></p>
<div class="profile"><div class="avatar big">${av}</div><div><h1>${esc(fullName(p))}</h1><p class="lead">${esc([p.position, p.group && tg(p.group)].filter(Boolean).join(' · '))}</p>
<div class="tags">${p.interests.map(tag).join('')}</div>
${contact.length ? `<ul class="contact-list">${contact.map(([l, u]) => `<li><a href="${esc(u)}" rel="noopener">${esc(l)}</a></li>`).join('')}</ul>` : ''}</div></div>
${p.summary ? `<p class="lead">${esc(p.summary)}</p>` : ''}
${p.body ? `<div class="prose">${md(p.body)}</div>` : ''}
${section(t('nav.projects'), prs.length ? `<div class="grid">${prs.map((x) => projectCard(x, '../../')).join('')}</div>` : '')}
${section(t('nav.papers'), ps.length ? `<ul class="entries">${ps.map((x) => paperItem(x, '../../')).join('')}</ul>` : '')}
${section(t('nav.conferences'), cs.length ? `<ul class="entries">${cs.map((x) => confItem(x, '../../')).join('')}</ul>` : '')}
</section>` });
}

// Papers
page('papers/index.html', { title: t('nav.papers'), root: '../', active: 'papers', body: `
<section class="wrap pagehead"><h1>${t('nav.papers')}</h1><p class="lead">${t('papers.lead')}</p>${searchBox(t('papers.search'))}${lineFilters()}</section>
<div class="wrap">${yearGroups(allPapers, (p) => p.year, (p) => paperItem(p, '../')) || `<p class="empty">${t('papers.empty')}</p>`}<p class="empty" hidden>${t('noresults')}</p></div>` });
for (const p of papers) {
  const ext = [p.doi && { label: `DOI: ${p.doi}`, url: doiUrl(p.doi) }, p.url && { label: t('link'), url: p.url }, p.pdf && { label: 'PDF', url: isUrl(p.pdf) ? p.pdf : `../../${asset('papers', p.pdf)}` }, ...p.links.map(splitLink)].filter(Boolean);
  page(`papers/${p.id}/index.html`, { title: p.title, root: '../../', active: 'papers', description: p.abstract, body: `
<section class="wrap detail"><p><a href="../">${t('back.papers')}</a></p><h1>${esc(p.title)}</h1>
<p class="authors lead">${authorsHtml(p.authors, '../../')}</p><p class="meta">${esc([p.venue, p.year, p.type].filter(Boolean).join(' · '))}</p>
${ext.length ? `<ul class="linklist">${ext.map((l) => `<li><a href="${esc(l.url)}" rel="noopener">${esc(l.label)}</a></li>`).join('')}</ul>` : ''}
${mediaBlock(p.video, '../../')}${p.abstract ? `<h2>${t('abstract')}</h2><div class="prose">${md(p.abstract)}</div>` : ''}${p.body ? `<div class="prose">${md(p.body)}</div>` : ''}
${section(t('nav.projects'), `<div class="grid">${p.projects.map((i) => projectCard(PR[i], '../../')).join('')}</div>`)}</section>` });
}

// Events
const up = sortedEvents.filter((e) => (e.endDate || e.date) >= today).reverse(), past = sortedEvents.filter((e) => (e.endDate || e.date) < today);
page('events/index.html', { title: t('nav.events'), root: '../', active: 'events', body: `
<section class="wrap pagehead"><h1>${t('nav.events')}</h1><p class="lead">${t('events.lead')}</p>${searchBox(t('events.search'))}</section>
${up.length ? `<section class="wrap js-sec"><h2>${t('events.upcoming')}</h2><div class="grid">${up.map((e) => eventCard(e, '../')).join('')}</div></section>` : ''}
${past.length ? `<section class="wrap js-sec"><h2>${t('events.past')}</h2><div class="grid">${past.map((e) => eventCard(e, '../')).join('')}</div></section>` : ''}
${!events.length ? `<p class="wrap empty">${t('events.empty')}</p>` : ''}<p class="wrap empty" hidden>${t('noresults')}</p>` });
for (const e of events) {
  const cs = confsOf((c) => c.event === e.id);
  const ext = [e.url && { label: t('eventWeb'), url: e.url }, ...e.links.map(splitLink)].filter(Boolean);
  page(`events/${e.id}/index.html`, { title: e.title, root: '../../', active: 'events', description: e.summary, body: `
<section class="wrap detail"><p><a href="../">${t('back.events')}</a></p><h1>${esc(e.title)}</h1>
<p class="lead">${esc(dateRange(e))}${e.location ? ` · <span class="pin"></span>${esc(e.location)}` : ''}${e.type ? ` · ${esc(e.type)}` : ''}</p>
${e.image ? thumb(`../../assets/img/events/${esc(e.image)}`, 'big') : ''}${mediaBlock(e.video, '../../')}${e.summary ? `<p>${esc(e.summary)}</p>` : ''}<div class="prose">${md(e.body)}</div>
${ext.length ? `<ul class="linklist">${ext.map((l) => `<li><a href="${esc(l.url)}" rel="noopener">${esc(l.label)}</a></li>`).join('')}</ul>` : ''}
${section(t('nav.conferences'), cs.length ? `<ul class="entries">${cs.map((c) => confItem(c, '../../')).join('')}</ul>` : '')}</section>` });
}

// Conferences
page('conferences/index.html', { title: t('nav.conferences'), root: '../', active: 'conferences', body: `
<section class="wrap pagehead"><h1>${t('nav.conferences')}</h1><p class="lead">${t('conf.lead')}</p>${searchBox(t('conf.search'))}</section>
<div class="wrap">${yearGroups(allConfs, (c) => (c.date || EV[c.event].date).slice(0, 4), (c) => confItem(c, '../')) || `<p class="empty">${t('conf.empty')}</p>`}<p class="empty" hidden>${t('noresults')}</p></div>` });
for (const c of conferences) {
  const ev = EV[c.event];
  const ext = [c.url && { label: t('link'), url: c.url }, c.slides && { label: 'Slides', url: isUrl(c.slides) ? c.slides : `../../${asset('papers', c.slides)}` }, ...c.links.map(splitLink)].filter(Boolean);
  page(`conferences/${c.id}/index.html`, { title: c.title, root: '../../', active: 'conferences', description: c.abstract, body: `
<section class="wrap detail"><p><a href="../">${t('back.conferences')}</a></p><h1>${esc(c.title)}</h1>
<p class="authors lead">${authorsHtml(c.authors, '../../')}</p>
<p class="meta">${esc([c.type, fmtDate(c.date || ev.date)].filter(Boolean).join(' · '))} · <a href="../../events/${ev.id}/">${esc(ev.title)}</a></p>
${ext.length ? `<ul class="linklist">${ext.map((l) => `<li><a href="${esc(l.url)}" rel="noopener">${esc(l.label)}</a></li>`).join('')}</ul>` : ''}
${mediaBlock(c.video, '../../')}${c.abstract ? `<h2>${t('abstract')}</h2><div class="prose">${md(c.abstract)}</div>` : ''}${c.body ? `<div class="prose">${md(c.body)}</div>` : ''}
${section(t('event.one'), `<div class="grid">${eventCard(ev, '../../')}</div>`)}
${section(t('nav.projects'), c.projects.length ? `<div class="grid">${c.projects.map((i) => projectCard(PR[i], '../../')).join('')}</div>` : '')}</section>` });
}

} // end buildLang
for (const l of I18N.languages) { setLang(l.code); buildLang(); }
setLang('es');

// GitHub Pages: disable Jekyll and provide a 404 page. 404 can be served from any depth,
// so it uses absolute URLs built from site.json -> baseUrl ("/" for user/custom domain, "/<repo>/" for project pages).
writeFileSync(join(DIST, '.nojekyll'), '');
if (existsSync(join(ROOT, 'CNAME'))) cpSync(join(ROOT, 'CNAME'), join(DIST, 'CNAME'));
const base = site.baseUrl || '/';
const all4 = (k) => I18N.languages.map((l) => I18N.ui[k][l.code]);
write('404.html', layout({ title: I18N.ui['404.title'].es, root: base, active: '', body: `<section class="wrap pagehead"><h1>${esc(all4('404.title').join(' · '))}</h1><p class="lead">${all4('404.text').map(esc).join('<br>')}</p><p><a class="btn" href="${base}">${all4('404.home').map(esc).join(' / ')}</a></p></section>` }));

console.log(`Built ${RAW.lines.length} lines, ${people.length} people, ${projects.length} projects, ${papers.length} papers, ${events.length} events, ${conferences.length} conferences -> docs/`);
