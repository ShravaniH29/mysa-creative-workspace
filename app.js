/* =============================================================
   MYSA · app.js
   A small single-page prototype with no framework:
   - state lives in one object, saved to localStorage
   - the URL hash decides which view is shown (#/, #/projects, #/p/:id/:section)
   - every view is a function that returns an HTML string
   - clicks and form submits are handled by two delegated listeners
   ============================================================= */
'use strict';

const STORAGE_KEY = 'mysa-redesign-v1';

const SECTIONS = [
  ['overview', 'Overview'],
  ['direction', 'Direction'],
  ['work', 'Work & feedback'],
  ['decisions', 'Decisions'],
  ['review', 'Review'],
  ['history', 'History']
];

// One table for every status label, so wording stays consistent everywhere.
const STATUS = {
  draft: { label: 'Draft', cls: 'draft' },
  in_review: { label: 'In review', cls: 'review' },
  changes_requested: { label: 'Changes requested', cls: 'changes' },
  approved: { label: 'Approved', cls: 'approved' },
  proposed: { label: 'Waiting for agreement', cls: 'review' },
  agreed: { label: 'Agreed', cls: 'agreed' },
  exploring: { label: 'Exploring', cls: 'draft' },
  open: { label: 'Open', cls: 'open' },
  in_decision: { label: 'In a decision', cls: 'review' },
  addressed: { label: 'Addressed', cls: 'agreed' }
};

// Where a feedback pin sits on the artwork, by area.
const PIN_POSITIONS = {
  'Wordmark': [50, 44],
  'Monogram': [50, 20],
  'Brass detail': [58, 66],
  'Colour': [88, 14],
  'Typography': [24, 44],
  'General': [8, 12]
};

/* ---------- Small helpers ---------- */
const $ = (selector, root = document) => root.querySelector(selector);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function nowISO() { return new Date().toISOString(); }
function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function pad(n) { return String(n).padStart(2, '0'); }
function lines(text) { return String(text || '').split('\n').map(s => s.trim()).filter(Boolean); }

function statusTag(key, overrideLabel) {
  const s = STATUS[key] || STATUS.draft;
  return `<span class="status status--${s.cls}"><span class="status__mark" aria-hidden="true"></span>${esc(overrideLabel || s.label)}</span>`;
}

/* ---------- Demo data ---------- */
function seedState() {
  return {
    role: 'designer',
    projects: [
      {
        id: 'fenwick',
        name: 'Fenwick House',
        client: 'Clara Holt',
        designer: 'Ravi Menon',
        type: 'Brand identity',
        createdAt: '2026-09-02',
        intent: "We're reopening my grandmother's guesthouse by the harbour. It should feel warm, but not rustic. Considered, but not a boutique-hotel cliché.",
        direction: {
          status: 'agreed',
          agreements: { designer: '2026-09-09', client: '2026-09-10' },
          lines: [
            { word: 'Warm', phrase: 'Warm through material, not nostalgia.' },
            { word: 'Considered', phrase: 'Considered through restraint and good paper.' },
            { word: 'Coastal', phrase: 'Coastal in light and colour, never anchors and rope.' }
          ],
          boundaries: [
            { want: 'Oyster, brass and deep sea-green.', avoid: 'Nautical clichés.' },
            { want: 'Type that feels made to last.', avoid: 'Script that reads like a wedding invite.' }
          ]
        },
        references: [
          { title: 'Harbour at 7am', swatches: ['#E8E1D3', '#9DB0AE', '#5E7570'], note: 'The light we want: pale, slightly grey, not postcard blue.' },
          { title: 'Brass room numbers', swatches: ['#B08A4A', '#23392F'], note: 'Small, solid, made to last. Detail over decoration.' },
          { title: 'Linen and limewash', swatches: ['#F1ECE2', '#D9CFBF'], note: 'Texture the eye can feel.' }
        ],
        versions: [
          { id: 'v1', num: 1, title: 'Harbour serif, first concept', summary: 'Serif wordmark with a rope-line monogram.', status: 'changes_requested', basedOn: null, createdAt: '2026-09-14', sentAt: '2026-09-14',
            art: { bg: '#E8E1D3', fg: '#23392F', accent: '#5E7570', track: 0, italic: true, rope: true, sub: 'Guesthouse · Whitstable' } },
          { id: 'v2', num: 2, title: 'Wordmark without the monogram', summary: 'Rope monogram removed. A single brass rule carries the detail.', status: 'changes_requested', basedOn: 'd1', createdAt: '2026-09-22', sentAt: '2026-09-23',
            art: { bg: '#23392F', fg: '#E8E1D3', accent: '#B08A4A', track: 0.01, italic: false, rope: false, sub: 'Whitstable · Est. 1931' } },
          { id: 'v3', num: 3, title: 'Wordmark with more air', summary: 'Letter spacing opened up. Everything else held.', status: 'in_review', basedOn: 'd2', createdAt: '2026-10-02', sentAt: '2026-10-03',
            art: { bg: '#23392F', fg: '#E8E1D3', accent: '#B08A4A', track: 0.07, italic: false, rope: false, sub: 'Whitstable · Est. 1931' } }
        ],
        feedback: [
          { id: 'f1', versionId: 'v1', role: 'client', area: 'Monogram', text: 'The rope monogram reads like a seafood restaurant.', link: 'Coastal', status: 'addressed', createdAt: '2026-09-15' },
          { id: 'f2', versionId: 'v1', role: 'designer', area: 'Monogram', text: 'Agreed. It leans on the theme instead of the place. I would drop it.', link: null, status: 'addressed', createdAt: '2026-09-15' },
          { id: 'f3', versionId: 'v2', role: 'client', area: 'Wordmark', text: "Closer. The name feels a little tight, like it's holding its breath.", link: 'Considered', status: 'addressed', createdAt: '2026-09-25' },
          { id: 'f4', versionId: 'v3', role: 'client', area: 'Brass detail', text: 'I like the brass. Could the room-number style carry into signage?', link: 'Considered', status: 'open', createdAt: '2026-10-04' }
        ],
        decisions: [
          { id: 'd1', num: 1, title: 'Remove the nautical monogram', statement: 'Drop the rope monogram and let the wordmark carry the identity, with brass as the only detail.',
            changes: ['Remove the rope monogram', 'Introduce a single brass rule'], stays: ['Serif wordmark', 'Oyster and sea-green palette'],
            why: 'The monogram pulled the brand toward a theme restaurant, against "Coastal, never anchors and rope."',
            sources: ['f1', 'f2'], versionId: 'v1', status: 'agreed', agreements: { designer: '2026-09-17', client: '2026-09-18' }, createdAt: '2026-09-16' },
          { id: 'd2', num: 2, title: 'Give the wordmark more air', statement: 'Open the letter spacing so the name feels calm and generous, without changing the typeface.',
            changes: ['Wider letter spacing on the wordmark'], stays: ['The serif typeface', 'Brass rule and palette', 'Overall layout'],
            why: 'Clara felt the name was holding its breath. More space reads as considered, not tight.',
            sources: ['f3'], versionId: 'v2', status: 'agreed', agreements: { designer: '2026-09-28', client: '2026-09-29' }, createdAt: '2026-09-27' }
        ],
        approvals: []
      },
      {
        id: 'lumen',
        name: 'Lumen Ceramics',
        client: 'Iris Okafor',
        designer: 'Ravi Menon',
        type: 'Packaging',
        createdAt: '2026-10-12',
        intent: 'Our cups are thrown by hand in a small studio. The boxes should feel as careful as the clay, and still survive the post.',
        direction: {
          status: 'exploring',
          agreements: {},
          lines: [{ word: 'Careful', phrase: 'Careful in the folding, not in decoration.' }],
          boundaries: []
        },
        references: [],
        versions: [],
        feedback: [],
        decisions: [],
        approvals: []
      }
    ]
  };
}

/* ---------- State: load, validate, save ---------- */
function normaliseProject(p) {
  // Fill any missing parts so old or hand-edited data cannot crash rendering.
  p.versions = Array.isArray(p.versions) ? p.versions : [];
  p.feedback = Array.isArray(p.feedback) ? p.feedback : [];
  p.decisions = Array.isArray(p.decisions) ? p.decisions : [];
  p.approvals = Array.isArray(p.approvals) ? p.approvals : [];
  p.references = Array.isArray(p.references) ? p.references : [];
  p.direction = p.direction && typeof p.direction === 'object' ? p.direction : {};
  p.direction.lines = Array.isArray(p.direction.lines) ? p.direction.lines : [];
  p.direction.boundaries = Array.isArray(p.direction.boundaries) ? p.direction.boundaries : [];
  p.direction.agreements = p.direction.agreements && typeof p.direction.agreements === 'object' ? p.direction.agreements : {};
  p.direction.status = p.direction.status === 'agreed' ? 'agreed' : 'exploring';
  p.decisions.forEach(d => { d.agreements = d.agreements || {}; d.sources = Array.isArray(d.sources) ? d.sources : []; });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const data = JSON.parse(raw);
    const valid = data && Array.isArray(data.projects) && ['designer', 'client'].includes(data.role)
      && data.projects.every(p => p && typeof p.id === 'string' && typeof p.name === 'string');
    if (!valid) throw new Error('Unexpected data shape');
    data.projects.forEach(normaliseProject);
    return data;
  } catch (err) {
    console.warn('Mysa: saved data could not be read, so the demo data was restored.', err);
    return seedState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    toast('Could not save. Browser storage may be full or turned off.', 'error');
    return false;
  }
}

let state = loadState();

/* ---------- Lookups ---------- */
const getProject = id => state.projects.find(p => p.id === id);
const latestVersion = p => p.versions.reduce((a, v) => (!a || v.num > a.num ? v : a), null);
const versionById = (p, id) => p.versions.find(v => v.id === id);
const decisionById = (p, id) => p.decisions.find(d => d.id === id);
const personName = (p, role) => (role === 'client' ? p.client : p.designer);
const firstName = name => String(name || '').split(' ')[0];
const roleLabel = role => (role === 'client' ? 'Client' : 'Designer');
const versionLabel = v => `V${pad(v.num)}`;

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(message, type = 'info') {
  const el = $('#toast');
  el.textContent = message;
  el.className = 'toast' + (type === 'error' ? ' toast--error' : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3600);
}

/* ---------- Router ---------- */
function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'projects') return { view: 'projects' };
  if (parts[0] === 'p' && parts[1]) {
    const section = SECTIONS.some(s => s[0] === parts[2]) ? parts[2] : 'overview';
    return { view: 'project', id: parts[1], section, sub: parts[3] || null };
  }
  // Anything else, including in-page anchors like #how, is the landing page.
  return { view: 'landing' };
}

let lastRouteKey = '';
function render() {
  const route = parseRoute();
  const routeKey = route.view + (route.id || '') + (route.section || '') + (route.sub || '');
  const changed = routeKey !== lastRouteKey;
  lastRouteKey = routeKey;

  const landing = $('#view-landing');
  const app = $('#view-app');
  const skip = $('#skip-link');

  if (route.view === 'landing') {
    if (!landing.hidden && !app.hidden) app.hidden = true;
    const wasApp = landing.hidden;
    landing.hidden = false;
    app.hidden = true;
    skip.setAttribute('href', '#main');
    document.title = 'Mysa · Keep the idea, the work and the decisions connected';
    if (wasApp) window.scrollTo(0, 0);
    return;
  }

  landing.hidden = true;
  app.hidden = false;
  skip.setAttribute('href', '#app-content');

  const project = route.view === 'project' ? getProject(route.id) : null;
  renderRail(route, project);
  renderAppBar(route, project);
  renderRoleSwitch();

  const content = $('#app-content');
  if (route.view === 'projects') {
    content.innerHTML = viewProjects();
    document.title = 'Projects · Mysa';
  } else if (!project) {
    content.innerHTML = viewNotFound();
    document.title = 'Not found · Mysa';
  } else {
    content.innerHTML = VIEWS[route.section](project, route);
    document.title = `${project.name} · ${SECTIONS.find(s => s[0] === route.section)[1]} · Mysa`;
  }

  // Move focus only when the page actually changes, not after every action.
  if (changed) {
    window.scrollTo(0, 0);
    content.focus({ preventScroll: true });
  }
}

/* ---------- Shell: rail, breadcrumb, role switch ---------- */
function railLink(href, label, active, count) {
  return `<a class="rail__link${active ? ' is-active' : ''}" href="${href}"${active ? ' aria-current="page"' : ''}>${esc(label)}${count ? `<span class="rail__count">${count}</span>` : ''}</a>`;
}

function renderRail(route, project) {
  let html = railLink('#/projects', 'All projects', route.view === 'projects');
  if (project) {
    const open = project.feedback.filter(f => f.status === 'open').length;
    const pending = project.decisions.filter(d => d.status === 'proposed').length;
    html += `<div class="rail__group">
      <div class="rail__project">
        <p class="rail__label">Project</p>
        <p class="rail__pname">${esc(project.name)}</p>
        <p class="rail__pmeta">${esc(project.client)} · ${esc(project.type)}</p>
      </div>
      ${SECTIONS.map(([key, label]) => railLink(`#/p/${project.id}/${key}`, label, route.section === key,
        key === 'work' ? open : key === 'decisions' ? pending : 0)).join('')}
    </div>`;
  }
  $('#rail-nav').innerHTML = html;
}

function renderAppBar(route, project) {
  const crumbs = ['<a href="#/projects">Projects</a>'];
  if (route.view === 'projects') crumbs[0] = '<span aria-current="page">Projects</span>';
  if (project) {
    crumbs.push(`<a href="#/p/${project.id}/overview">${esc(project.name)}</a>`);
    const label = SECTIONS.find(s => s[0] === route.section)[1];
    crumbs.push(`<span aria-current="page">${esc(label)}</span>`);
  }
  $('#appbar-crumbs').innerHTML = crumbs.join('<span class="appbar__sep" aria-hidden="true">/</span>');
}

function renderRoleSwitch() {
  document.querySelectorAll('.role-switch__btn').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.role === state.role));
  });
}

/* ---------- Shared view pieces ---------- */
function pageHead(eyebrow, title, sub = '', aside = '') {
  return `<header class="page-head">
    <div><p class="eyebrow">${esc(eyebrow)}</p><h1 class="page-title">${esc(title)}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}</div>
    ${aside}
  </header>`;
}

function emptyState(title, text, action = '') {
  return `<div class="empty"><p class="empty__title">${esc(title)}</p><p class="empty__text">${text}</p>${action}</div>`;
}

function renderArt(project, version, size = 'large', pins = []) {
  const a = version.art || {};
  const style = `--art-bg:${esc(a.bg || '#E9E5DC')};--art-fg:${esc(a.fg || '#1D1A2B')};--art-accent:${esc(a.accent || '#4434C8')};--art-track:${Number(a.track) || 0}em`;
  const pinHtml = pins.map(({ n, area }) => {
    const [x, y] = PIN_POSITIONS[area] || PIN_POSITIONS.General;
    return `<span class="pin art__pin" style="left:${x}%;top:${y}%" aria-hidden="true">${n}</span>`;
  }).join('');
  return `<figure class="art art--${size}" style="${style}">
    ${a.rope ? '<span class="art__rope" aria-hidden="true"></span>' : ''}
    <p class="art__name${a.italic ? ' is-italic' : ''}">${esc(project.name)}</p>
    <span class="art__rule" aria-hidden="true"></span>
    <p class="art__sub">${esc(a.sub || project.type)}</p>
    ${pinHtml}
    <figcaption class="visually-hidden">${esc(project.name)} ${esc(versionLabel(version))}: ${esc(version.summary)}</figcaption>
  </figure>`;
}

function decisionLink(p, id) {
  const d = decisionById(p, id);
  return d ? `<a href="#/p/${p.id}/decisions">Decision ${pad(d.num)}</a>` : '';
}

/* What should happen next? Used on the overview. */
function nextStep(p) {
  const role = state.role;
  const v = latestVersion(p);
  const waiting = p.decisions.find(d => d.status === 'proposed');
  const agreedNoVersion = p.decisions.find(d => d.status === 'agreed' && !p.versions.some(x => x.basedOn === d.id));

  if (p.direction.status !== 'agreed') {
    return { text: 'The creative direction is still being explored. Agree it together before the work starts.', href: `#/p/${p.id}/direction`, cta: 'Open direction' };
  }
  if (waiting) {
    const missing = ['designer', 'client'].filter(r => !waiting.agreements[r]).map(r => firstName(personName(p, r)));
    return { text: `Decision ${pad(waiting.num)} is waiting for ${missing.join(' and ')} to agree.`, href: `#/p/${p.id}/decisions`, cta: 'Open decisions' };
  }
  if (!v) {
    return role === 'designer'
      ? { text: 'The direction is agreed. Add the first version of the work.', href: `#/p/${p.id}/work`, cta: 'Go to work' }
      : { text: `${firstName(p.designer)} is preparing the first version.`, href: `#/p/${p.id}/direction`, cta: 'Review the direction' };
  }
  if (agreedNoVersion && v.status !== 'in_review' && v.status !== 'draft') {
    return { text: `Decision ${pad(agreedNoVersion.num)} is agreed. The next version can now be made from it.`, href: `#/p/${p.id}/decisions`, cta: 'Open decisions' };
  }
  if (v.status === 'draft') {
    return { text: `${versionLabel(v)} is a draft. Send it to ${firstName(p.client)} when it's ready.`, href: `#/p/${p.id}/review`, cta: 'Open review' };
  }
  if (v.status === 'in_review') {
    return role === 'client'
      ? { text: `${versionLabel(v)} is waiting for your review.`, href: `#/p/${p.id}/review`, cta: 'Review the version' }
      : { text: `${versionLabel(v)} is with ${firstName(p.client)} for review.`, href: `#/p/${p.id}/work/${v.id}`, cta: 'See the work' };
  }
  if (v.status === 'changes_requested') {
    return { text: `Changes were requested on ${versionLabel(v)}. Turn the feedback into a decision.`, href: `#/p/${p.id}/work/${v.id}`, cta: 'Open feedback' };
  }
  const ap = p.approvals.find(a => a.versionId === v.id);
  return { text: `${versionLabel(v)} was approved${ap ? ' on ' + fmtDate(ap.at) : ''}. It is the final identity.`, href: `#/p/${p.id}/review`, cta: 'See approval' };
}

/* ---------- Views ---------- */
function viewProjects() {
  const head = pageHead('Workspace', 'Projects', '', '<button type="button" class="btn btn--primary" data-action="new-project">New project</button>');
  if (!state.projects.length) {
    return head + emptyState('No projects yet', 'Start with the brief in your client\'s own words. Everything else attaches to it.',
      '<button type="button" class="btn btn--primary" data-action="new-project">Start a project</button>');
  }
  const rows = state.projects.map(p => {
    const v = latestVersion(p);
    const state_ = v ? `${statusTag(v.status, `${versionLabel(v)} · ${STATUS[v.status].label}`)}` : statusTag('draft', 'No versions yet');
    return `<a class="project-row" href="#/p/${p.id}/overview">
      <div><p class="project-row__name">${esc(p.name)}</p><p class="project-row__meta">${esc(p.client)} · ${esc(p.type)}</p></div>
      <div>${state_}</div>
      <span class="project-row__open">Open <span aria-hidden="true">→</span></span>
    </a>`;
  }).join('');
  return head + `<div class="project-list">${rows}</div>`;
}

function viewNotFound() {
  return pageHead('Not found', 'This project isn\'t here') +
    emptyState('It may have been removed', 'If you reset the demo data, projects you created are cleared.', '<a class="btn btn--secondary" href="#/projects">Back to projects</a>');
}

function viewOverview(p) {
  const v = latestVersion(p);
  const step = nextStep(p);
  const trail = [];
  trail.push({ when: p.direction.status === 'agreed' ? fmtDate(p.direction.agreements.client || p.direction.agreements.designer) : '—', what: 'Creative direction', status: p.direction.status, href: `#/p/${p.id}/direction` });
  p.decisions.slice(-1).forEach(d => trail.push({ when: fmtDate(d.agreements.client || d.createdAt), what: `Decision ${pad(d.num)} · ${d.title}`, status: d.status, href: `#/p/${p.id}/decisions` }));
  if (v) trail.push({ when: fmtDate(v.createdAt), what: `${versionLabel(v)} · ${v.title}`, status: v.status, href: `#/p/${p.id}/work/${v.id}` });

  return pageHead(p.type, p.name, `${esc(p.client)}, client · ${esc(p.designer)}, designer`) + `
  <div class="layout">
    <div class="stack">
      ${v ? `<div class="sheet sheet--flush">${renderArt(p, v)}<div class="version-meta"><span class="version-meta__title">${esc(versionLabel(v))} · ${esc(v.title)}</span>${statusTag(v.status)}</div></div>` : ''}
      <div class="sheet next-step">
        <p class="label">Next</p>
        <p class="next-step__text">${esc(step.text)}</p>
        <div class="actions"><a class="btn btn--primary btn--small" href="${step.href}">${esc(step.cta)}</a></div>
      </div>
    </div>
    <aside class="margin" aria-label="Project context">
      <div class="margin__block">
        <p class="label">The brief, in ${esc(firstName(p.client))}'s words</p>
        <p class="quote">“${esc(p.intent)}”</p>
      </div>
      <div class="margin__block">
        <p class="label">How we got here</p>
        <div class="trail">
          ${trail.map(t => `<div class="trail__item"><span class="meta">${esc(t.when)}</span><a class="trail__what" href="${t.href}">${esc(t.what)}</a>${statusTag(t.status)}</div>`).join('')}
        </div>
      </div>
    </aside>
  </div>`;
}

function viewDirection(p) {
  const d = p.direction;
  const agreed = d.status === 'agreed';
  const roleAgreed = !!d.agreements[state.role];

  const linesHtml = d.lines.length
    ? `<div class="direction-lines">${d.lines.map(l => `<div class="direction-line"><span class="direction-line__word">${esc(l.word)}</span><p class="direction-line__phrase">${esc(l.phrase)}</p></div>`).join('')}</div>`
    : `<p class="muted">No phrases yet. Take one word from the brief and say what it means for this project.</p>`;

  const agreementRows = ['designer', 'client'].map(r => `<div class="agreement__row">
      <span class="agreement__who">${esc(personName(p, r))} · ${roleLabel(r)}</span>
      <span class="meta">${d.agreements[r] ? 'Agreed ' + esc(fmtDate(d.agreements[r])) : 'Not yet agreed'}</span>
    </div>`).join('');

  const directionBlock = agreed
    ? `<section class="record" aria-label="Agreed direction">
        <div class="decision__head"><p class="label">Our direction</p>${statusTag('agreed')}</div>
        ${linesHtml}
        <div class="agreement">${agreementRows}</div>
        <p class="meta">Agreed directions are locked. A later change becomes a new decision.</p>
      </section>`
    : `<section class="sheet" aria-labelledby="dir-title">
        <div class="sheet__head"><h2 id="dir-title" class="sheet__title">Our direction</h2>${statusTag('exploring')}</div>
        ${linesHtml}
        <form class="form" data-form="direction-line" novalidate style="margin-top:20px">
          <div class="field-row">
            <div class="field"><label for="dl-word">Word from the brief</label><input id="dl-word" name="word" maxlength="24" required autocomplete="off"></div>
            <div class="field"><label for="dl-phrase">What it means here</label><input id="dl-phrase" name="phrase" maxlength="120" required autocomplete="off"></div>
          </div>
          <p class="form-error" role="alert" hidden></p>
          <div class="actions"><button type="submit" class="btn btn--secondary btn--small">Add phrase</button></div>
        </form>
        <div class="agreement" style="margin-top:24px">${agreementRows}</div>
        <div class="actions" style="margin-top:12px">
          <button type="button" class="btn btn--primary" data-action="agree-direction"${roleAgreed ? ' disabled' : ''}>${roleAgreed ? 'You have agreed' : `Agree to this direction as ${roleLabel(state.role).toLowerCase()}`}</button>
        </div>
      </section>`;

  const boundaries = d.boundaries.length
    ? `<section class="sheet" aria-labelledby="b-title"><div class="sheet__head"><h2 id="b-title" class="sheet__title">Boundaries</h2></div>
        ${d.boundaries.map(b => `<div class="boundaries"><p class="boundaries__cell"><span class="label">We want</span><br>${esc(b.want)}</p><p class="boundaries__cell"><span class="label">We don't want</span><br>${esc(b.avoid)}</p></div>`).join('')}
      </section>` : '';

  const refs = p.references.length
    ? `<section aria-labelledby="r-title" class="stack"><h2 id="r-title" class="label">References, and why they matter</h2>
        <div class="refs">${p.references.map(r => `<article class="ref">
          <div class="ref__swatches">${(r.swatches || []).map(c => `<span style="background:${esc(c)}"></span>`).join('')}</div>
          <div class="ref__body"><p class="ref__title">${esc(r.title)}</p><p class="ref__note">${esc(r.note)}</p></div>
        </article>`).join('')}</div></section>` : '';

  return pageHead('Creative direction', 'What the brief means') + `
  <div class="layout">
    <div class="stack">${directionBlock}${boundaries}${refs}</div>
    <aside class="margin" aria-label="The brief">
      <div class="margin__block"><p class="label">The brief, in ${esc(firstName(p.client))}'s words</p><p class="quote">“${esc(p.intent)}”</p></div>
      <div class="margin__block"><p class="margin__text">Each phrase turns one of the client's words into something you can both check the work against. Feedback later can point back to it.</p></div>
    </aside>
  </div>`;
}

function viewWork(p, route) {
  const head = pageHead('Work & feedback', 'The work under discussion');
  if (!p.versions.length) {
    const action = state.role === 'designer'
      ? (p.direction.status === 'agreed'
          ? '<button type="button" class="btn btn--primary" data-action="first-version">Add version 01</button>'
          : `<a class="btn btn--secondary" href="#/p/${p.id}/direction">Agree the direction first</a>`)
      : '';
    return head + emptyState('No work yet', p.direction.status === 'agreed'
      ? 'The direction is agreed. The first version will appear here, with feedback pinned to it.'
      : 'Work starts once the creative direction has been agreed by both of you.', action);
  }

  const v = versionById(p, route.sub) || latestVersion(p);
  const notes = p.feedback.filter(f => f.versionId === v.id);
  const clientNotes = notes.filter(f => f.role === 'client');
  const pins = clientNotes.map((f, i) => ({ n: i + 1, area: f.area }));
  const pinNo = id => clientNotes.findIndex(f => f.id === id) + 1;

  const tabs = `<nav class="vtabs" aria-label="Versions">${p.versions.slice().sort((a, b) => a.num - b.num).map(x =>
    `<a class="vtab" href="#/p/${p.id}/work/${x.id}" aria-current="${x.id === v.id}"><span class="vtab__num">${versionLabel(x)}</span>${statusTag(x.status)}</a>`).join('')}</nav>`;

  const list = notes.length ? `<div class="feedback-list">${notes.map(f => {
    const n = pinNo(f.id);
    const canDecide = state.role === 'designer' && f.status === 'open';
    return `<article class="feedback feedback__role--${f.role}">
      ${n ? `<span class="pin">${n}</span>` : '<span class="pin pin--muted" aria-hidden="true"></span>'}
      <div class="feedback__body">
        <p class="feedback__meta"><span>${esc(firstName(personName(p, f.role)))} · ${roleLabel(f.role)}</span><span>${esc(f.area)}</span><span>${esc(fmtDate(f.createdAt))}</span></p>
        <p class="feedback__text">${f.role === 'client' ? '“' + esc(f.text) + '”' : esc(f.text)}</p>
        <div class="feedback__foot">
          ${f.role === 'client' ? statusTag(f.status) : ''}
          ${f.link ? `<a class="muted" href="#/p/${p.id}/direction">Relates to ${esc(f.link)}</a>` : ''}
          ${canDecide ? `<button type="button" class="btn btn--secondary btn--small" data-action="new-decision" data-feedback="${f.id}">Turn into a decision</button>` : ''}
        </div>
      </div>
    </article>`;
  }).join('')}</div>` : '<p class="muted">No feedback on this version yet.</p>';

  const directionOptions = p.direction.lines.map(l => `<option>${esc(l.word)}</option>`).join('');
  const form = v.status === 'approved'
    ? '<p class="review-explain">This version is approved, so it no longer takes feedback. Start a new version from a decision if something needs to change.</p>'
    : `<form class="form" data-form="feedback" data-version="${v.id}" novalidate>
        <p class="label">Add a note to ${versionLabel(v)}</p>
        <div class="field-row">
          <div class="field"><label for="fb-area">Where</label><select id="fb-area" name="area">${Object.keys(PIN_POSITIONS).map(a => `<option>${a}</option>`).join('')}</select></div>
          <div class="field"><label for="fb-link">Relates to (optional)</label><select id="fb-link" name="link"><option value="">Nothing specific</option>${directionOptions}</select></div>
        </div>
        <div class="field"><label for="fb-text">What are you noticing?</label><textarea id="fb-text" name="text" rows="3" maxlength="400" required></textarea></div>
        <p class="form-error" role="alert" hidden></p>
        <div class="actions"><button type="submit" class="btn btn--primary btn--small">Add note as ${roleLabel(state.role).toLowerCase()}</button></div>
      </form>`;

  const based = v.basedOn ? `<p class="muted">Made from ${decisionLink(p, v.basedOn)}</p>` : '<p class="muted">First version</p>';

  return head + tabs + `
  <div class="layout">
    <div class="stack">
      <div class="sheet sheet--flush">
        ${renderArt(p, v, 'large', pins)}
        <div class="version-meta"><span class="version-meta__title">${esc(versionLabel(v))} · ${esc(v.title)}</span>${statusTag(v.status)}</div>
      </div>
      <section class="sheet" aria-labelledby="fb-title"><div class="sheet__head"><h2 id="fb-title" class="sheet__title">Feedback on ${versionLabel(v)}</h2></div>${list}</section>
    </div>
    <aside class="margin" aria-label="Version context">
      <div class="margin__block"><p class="label">About this version</p><p class="margin__text">${esc(v.summary)}</p>${based}<p class="meta">Created ${esc(fmtDate(v.createdAt))}</p></div>
      <div class="margin__block">${form}</div>
    </aside>
  </div>`;
}

function decisionCard(p, d) {
  const agreed = d.status === 'agreed';
  const fromVersion = versionById(p, d.versionId);
  const produced = p.versions.find(v => v.basedOn === d.id);
  const sources = d.sources.map(id => p.feedback.find(f => f.id === id)).filter(Boolean);
  const v = latestVersion(p);

  const cs = `<div class="cs">
    <div class="cs__col"><p class="label">What changes</p><ul>${d.changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
    <div class="cs__col"><p class="label">What stays</p><ul>${d.stays.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
  </div>`;

  const agreementRows = ['designer', 'client'].map(r => `<div class="agreement__row">
    <span class="agreement__who">${esc(personName(p, r))} · ${roleLabel(r)}</span>
    <span class="meta">${d.agreements[r] ? 'Agreed ' + esc(fmtDate(d.agreements[r])) : 'Not yet agreed'}</span></div>`).join('');

  let next = '';
  if (agreed) {
    if (produced) {
      next = `<p class="meta">Produced <a href="#/p/${p.id}/work/${produced.id}">${versionLabel(produced)}</a></p>`;
    } else if (state.role === 'designer') {
      const blocked = v && (v.status === 'in_review' || v.status === 'draft');
      next = `<div class="actions"><button type="button" class="btn btn--light btn--small" data-action="start-version" data-decision="${d.id}"${blocked ? ' aria-disabled="true"' : ''}>Start ${v ? 'V' + pad(v.num + 1) : 'V01'} from this decision</button>${blocked ? `<span class="meta">${versionLabel(v)} is still ${STATUS[v.status].label.toLowerCase()}.</span>` : ''}</div>`;
    } else {
      next = `<p class="meta">${esc(firstName(p.designer))} can now start the next version.</p>`;
    }
  } else {
    const mine = !!d.agreements[state.role];
    next = `<div class="actions"><button type="button" class="btn btn--primary btn--small" data-action="agree-decision" data-decision="${d.id}"${mine ? ' disabled' : ''}>${mine ? 'You have agreed' : 'Agree as ' + roleLabel(state.role).toLowerCase()}</button>
      <span class="meta">Agreeing is about what changes. It does not approve any version.</span></div>`;
  }

  return `<article class="${agreed ? 'record' : 'sheet'} decision" aria-labelledby="dec-${d.id}">
    <div class="decision__head"><p class="label" id="dec-${d.id}">Decision ${pad(d.num)} · ${esc(d.title)}</p>${statusTag(d.status)}</div>
    <p class="record__statement">${esc(d.statement)}</p>
    ${cs}
    <p class="why"><strong>Why.</strong> ${esc(d.why)}</p>
    ${sources.length ? `<p class="sources-line">From ${sources.map(f => `${esc(firstName(personName(p, f.role)))}'s note on ${esc(f.area.toLowerCase())}`).join(', ')}${fromVersion ? ` in <a href="#/p/${p.id}/work/${fromVersion.id}">${versionLabel(fromVersion)}</a>` : ''}</p>` : ''}
    <div class="agreement">${agreementRows}</div>
    ${next}
  </article>`;
}

function viewDecisions(p) {
  const aside = state.role === 'designer' ? '<button type="button" class="btn btn--primary" data-action="new-decision">New decision</button>' : '';
  const head = pageHead('Decisions', 'What we agreed to change', '', aside);
  if (!p.decisions.length) {
    return head + emptyState('No decisions yet', 'A decision records what changes, what stays and why. It usually starts from a piece of feedback on the work.',
      state.role === 'designer' ? '<button type="button" class="btn btn--primary" data-action="new-decision">Record a decision</button>' : '');
  }
  const list = p.decisions.slice().sort((a, b) => b.num - a.num).map(d => decisionCard(p, d)).join('');
  return head + `<div class="layout"><div class="stack">${list}</div>
    <aside class="margin"><div class="margin__block"><p class="label">How decisions work</p>
      <p class="margin__text">The designer proposes. Both people agree. Once agreed, a decision is locked and the next version is made from it. Changing it later means a new decision, so the history stays honest.</p></div></aside></div>`;
}

function viewReview(p) {
  const head = pageHead('Review', 'Approve the work itself');
  const v = latestVersion(p);
  if (!v) return head + emptyState('Nothing to review yet', 'A version appears here once the designer has made one.');

  const approval = p.approvals.find(a => a.versionId === v.id);
  const explain = '<p class="review-explain">Approval confirms this version as the finished work. It is separate from agreeing to a decision: an agreed decision says what to change, an approval accepts the result.</p>';
  let panel = '';

  if (v.status === 'approved' && approval) {
    panel = `<section class="record record--approved" aria-label="Approval">
      <div class="decision__head"><p class="label">${versionLabel(v)} · Final</p>${statusTag('approved')}</div>
      <p class="record__statement">${esc(v.title)} is approved.</p>
      <p class="meta">Approved by ${esc(approval.name)} · Client · ${esc(fmtDate(approval.at))}</p>
      <p class="meta">Earlier versions stay in the history, unchanged.</p>
    </section>`;
  } else if (v.status === 'draft') {
    panel = state.role === 'designer'
      ? `<section class="sheet"><p class="label">${versionLabel(v)} is a draft</p><p style="margin:10px 0 16px">When it's ready, send it to ${esc(firstName(p.client))}. After that, the version is fixed and feedback attaches to it.</p>
          <button type="button" class="btn btn--primary" data-action="send-review" data-version="${v.id}">Send ${versionLabel(v)} for review</button></section>`
      : `<section class="sheet"><p class="label">${versionLabel(v)} is a draft</p><p style="margin-top:10px">${esc(firstName(p.designer))} hasn't sent it for review yet.</p></section>`;
  } else if (v.status === 'in_review') {
    panel = state.role === 'client'
      ? `<section class="sheet" aria-labelledby="rv-title"><h2 id="rv-title" class="sheet__title">Your review of ${versionLabel(v)}</h2>
          <div class="actions" style="margin:16px 0 24px"><button type="button" class="btn btn--primary" data-action="approve" data-version="${v.id}">Approve ${versionLabel(v)}</button></div>
          <form class="form" data-form="request-changes" data-version="${v.id}" novalidate>
            <div class="field"><label for="rc-text">Something still needs changing</label><textarea id="rc-text" name="text" rows="3" maxlength="400" required placeholder="What still feels off?"></textarea>
            <p class="field__hint">Your note attaches to ${versionLabel(v)}. The version itself is kept as it is.</p></div>
            <p class="form-error" role="alert" hidden></p>
            <div class="actions"><button type="submit" class="btn btn--secondary">Request changes</button></div>
          </form></section>`
      : `<section class="sheet"><p class="label">${versionLabel(v)} · In review</p><p style="margin-top:10px">It's with ${esc(firstName(p.client))}. Switch the prototype view to Client to review it.</p></section>`;
  } else {
    panel = `<section class="sheet"><p class="label">${versionLabel(v)} · Changes requested</p><p style="margin:10px 0 16px">${esc(firstName(p.client))} asked for changes. The next step is a decision on what to change.</p>
      <a class="btn btn--secondary btn--small" href="#/p/${p.id}/work/${v.id}">Open the feedback</a></section>`;
  }

  return head + `<div class="layout">
    <div class="stack"><div class="sheet sheet--flush">${renderArt(p, v)}<div class="version-meta"><span class="version-meta__title">${esc(versionLabel(v))} · ${esc(v.title)}</span>${statusTag(v.status)}</div></div>${panel}</div>
    <aside class="margin"><div class="margin__block"><p class="label">Made from</p><p class="margin__text">${v.basedOn ? decisionLink(p, v.basedOn) + ': ' + esc((decisionById(p, v.basedOn) || {}).statement || '') : 'The agreed creative direction.'}</p></div>
      <div class="margin__block">${explain}</div></aside></div>`;
}

function viewHistory(p) {
  // History is built from the project's own records, so it can never drift from them.
  const ev = [];
  ev.push({ at: p.createdAt, kind: 'Project', text: `Started with the brief from ${p.client}.` });
  if (p.direction.status === 'agreed') ev.push({ at: p.direction.agreements.client || p.direction.agreements.designer, kind: 'Direction', text: 'Creative direction agreed by both.' });
  p.versions.forEach(v => {
    ev.push({ at: v.createdAt, kind: versionLabel(v), text: `${v.title}${v.basedOn ? ', made from Decision ' + pad((decisionById(p, v.basedOn) || {}).num || 0) : ''}.` });
    if (v.sentAt) ev.push({ at: v.sentAt, kind: versionLabel(v), text: `Sent to ${p.client} for review.` });
  });
  p.feedback.forEach(f => ev.push({ at: f.createdAt, kind: 'Feedback', text: `${firstName(personName(p, f.role))} on ${f.area.toLowerCase()} in ${versionLabel(versionById(p, f.versionId) || { num: 0 })}: “${f.text}”` }));
  p.decisions.forEach(d => {
    ev.push({ at: d.createdAt, kind: `Decision ${pad(d.num)}`, text: `Proposed: ${d.title}.` });
    if (d.status === 'agreed') ev.push({ at: d.agreements.client > d.agreements.designer ? d.agreements.client : d.agreements.designer, kind: `Decision ${pad(d.num)}`, text: 'Agreed by both.' });
  });
  p.approvals.forEach(a => ev.push({ at: a.at, kind: 'Approval', text: `${versionLabel(versionById(p, a.versionId) || { num: 0 })} approved by ${a.name}.` }));
  ev.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return pageHead('History', 'How the project got here') + `<div class="sheet"><ol class="history">${ev.map(e =>
    `<li class="history__item"><span class="meta">${esc(fmtDate(e.at))}</span><span class="history__kind">${esc(e.kind)}</span><span class="history__text">${esc(e.text)}</span></li>`).join('')}</ol></div>`;
}

const VIEWS = { overview: viewOverview, direction: viewDirection, work: viewWork, decisions: viewDecisions, review: viewReview, history: viewHistory };

/* ---------- Actions (button clicks) ---------- */
function currentProject() {
  const r = parseRoute();
  return r.view === 'project' ? getProject(r.id) : null;
}
function today() { return nowISO(); }
function commit(message) {
  if (saveState()) { render(); if (message) toast(message); }
}
function requireRole(role, message) {
  if (state.role !== role) { toast(message, 'error'); return false; }
  return true;
}

const ACTIONS = {
  'set-role'(el) {
    state.role = el.dataset.role === 'client' ? 'client' : 'designer';
    commit(`Now viewing as the ${state.role}.`);
  },
  'new-project'() { openProjectDialog(); },
  'new-project-from-landing'() { location.hash = '#/projects'; setTimeout(openProjectDialog, 50); },
  'close-dialog'(el) { el.closest('dialog').close(); },
  'reset-demo'() {
    if (!confirm('Reset the demo? Projects and changes you made in this browser will be cleared.')) return;
    state = seedState();
    location.hash = '#/projects';
    commit('Demo data restored.');
  },
  'agree-direction'() {
    const p = currentProject(); if (!p) return;
    if (!p.direction.lines.length) { toast('Add at least one phrase before agreeing.', 'error'); return; }
    p.direction.agreements[state.role] = today();
    const both = p.direction.agreements.designer && p.direction.agreements.client;
    if (both) p.direction.status = 'agreed';
    commit(both ? 'Direction agreed by both. It is now locked.' : `Your agreement is recorded. Waiting for the ${state.role === 'client' ? 'designer' : 'client'}.`);
  },
  'first-version'() {
    const p = currentProject(); if (!p) return;
    if (!requireRole('designer', 'Only the designer adds versions.')) return;
    p.versions.push({ id: uid('v'), num: 1, title: 'First concept', summary: 'The first version, made from the agreed direction.', status: 'draft', basedOn: null, createdAt: today(),
      art: { bg: '#E9E5DC', fg: '#1D1A2B', accent: '#4434C8', track: 0.02, italic: false, rope: false, sub: p.type } });
    commit('Version 01 added as a draft.');
  },
  'new-decision'(el) {
    const p = currentProject(); if (!p) return;
    if (!requireRole('designer', 'Switch to the designer view to propose a decision.')) return;
    openDecisionDialog(p, el.dataset.feedback || null);
  },
  'agree-decision'(el) {
    const p = currentProject(); if (!p) return;
    const d = decisionById(p, el.dataset.decision); if (!d || d.status === 'agreed') return;
    d.agreements[state.role] = today();
    if (d.agreements.designer && d.agreements.client) {
      d.status = 'agreed';
      d.sources.forEach(id => { const f = p.feedback.find(x => x.id === id); if (f) f.status = 'addressed'; });
      commit(`Decision ${pad(d.num)} agreed by both. The next version can be made from it.`);
    } else {
      commit(`Your agreement is recorded. Waiting for the ${state.role === 'client' ? 'designer' : 'client'}.`);
    }
  },
  'start-version'(el) {
    const p = currentProject(); if (!p) return;
    if (!requireRole('designer', 'Only the designer starts a version.')) return;
    const d = decisionById(p, el.dataset.decision);
    const prev = latestVersion(p);
    if (!d || d.status !== 'agreed') { toast('A version can only be made from an agreed decision.', 'error'); return; }
    if (p.versions.some(v => v.basedOn === d.id)) { toast('A version has already been made from this decision.', 'error'); return; }
    if (prev && (prev.status === 'in_review' || prev.status === 'draft')) {
      toast(`${versionLabel(prev)} is still ${STATUS[prev.status].label.toLowerCase()}. Finish its review first.`, 'error'); return;
    }
    // A new version is a new record. The previous version is copied, never edited.
    const art = Object.assign({}, prev ? prev.art : {}, { italic: false, rope: false });
    const num = prev ? prev.num + 1 : 1;
    const v = { id: uid('v'), num, title: d.title, summary: `Revision made from Decision ${pad(d.num)}: ${d.statement}`, status: 'draft', basedOn: d.id, createdAt: today(), art };
    p.versions.push(v);
    location.hash = `#/p/${p.id}/work/${v.id}`;
    commit(`${versionLabel(v)} created as a draft. ${prev ? versionLabel(prev) + ' stays in the history.' : ''}`);
  },
  'send-review'(el) {
    const p = currentProject(); if (!p) return;
    if (!requireRole('designer', 'Only the designer sends work for review.')) return;
    const v = versionById(p, el.dataset.version);
    if (!v || v.status !== 'draft') return;
    v.status = 'in_review'; v.sentAt = today();
    commit(`${versionLabel(v)} sent to ${firstName(p.client)} for review.`);
  },
  'approve'(el) {
    const p = currentProject(); if (!p) return;
    if (!requireRole('client', 'Only the client approves a version.')) return;
    const v = versionById(p, el.dataset.version);
    if (!v || v.status !== 'in_review') { toast('Only a version in review can be approved.', 'error'); return; }
    if (!confirm(`Approve ${versionLabel(v)} as the finished work?`)) return;
    v.status = 'approved';
    p.approvals.push({ versionId: v.id, name: p.client, at: today() });
    commit(`${versionLabel(v)} approved. The approval is recorded with today's date.`);
  }
};

/* ---------- Forms ---------- */
function showFormError(form, message, field) {
  const box = $('.form-error', form);
  box.textContent = message; box.hidden = false;
  form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
}
function clearFormError(form) {
  const box = $('.form-error', form); if (box) box.hidden = true;
  form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
}
// Returns the first empty required field, or null if all are filled.
function firstEmpty(form) {
  return Array.from(form.querySelectorAll('[required]')).find(el => !el.value.trim()) || null;
}

const FORMS = {
  project(form) {
    const empty = firstEmpty(form);
    if (empty) return showFormError(form, 'Please fill in every field. The brief can be one sentence.', empty);
    const data = new FormData(form);
    const name = data.get('name').trim();
    let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
    if (getProject(id)) id += '-' + Date.now().toString(36).slice(-4);
    const project = {
      id, name, client: data.get('client').trim(), designer: data.get('designer').trim(), type: data.get('type'),
      createdAt: today(), intent: data.get('intent').trim(),
      direction: { status: 'exploring', agreements: {}, lines: [], boundaries: [] },
      references: [], versions: [], feedback: [], decisions: [], approvals: []
    };
    state.projects.unshift(project);
    form.closest('dialog').close();
    location.hash = `#/p/${id}/direction`;
    commit(`${name} created. Start by agreeing what the brief means.`);
  },

  'direction-line'(form) {
    const p = currentProject(); if (!p) return;
    if (p.direction.status === 'agreed') return showFormError(form, 'This direction is agreed and locked.');
    const empty = firstEmpty(form);
    if (empty) return showFormError(form, 'Add both the word and what it means.', empty);
    const data = new FormData(form);
    p.direction.lines.push({ word: data.get('word').trim(), phrase: data.get('phrase').trim() });
    p.direction.agreements = {}; // the direction changed, so earlier agreement no longer applies
    commit('Phrase added. Any earlier agreement was cleared because the direction changed.');
  },

  feedback(form) {
    const p = currentProject(); if (!p) return;
    const v = versionById(p, form.dataset.version);
    if (!v || v.status === 'approved') return showFormError(form, 'This version no longer takes feedback.');
    const text = form.elements.text;
    if (text.value.trim().length < 3) return showFormError(form, 'Write a few words about what you notice.', text);
    p.feedback.push({ id: uid('f'), versionId: v.id, role: state.role, area: form.elements.area.value,
      text: text.value.trim(), link: form.elements.link.value || null, status: state.role === 'client' ? 'open' : 'addressed', createdAt: today() });
    commit(`Note added to ${versionLabel(v)}.`);
  },

  'request-changes'(form) {
    const p = currentProject(); if (!p) return;
    if (!requireRole('client', 'Only the client requests changes.')) return;
    const v = versionById(p, form.dataset.version);
    if (!v || v.status !== 'in_review') return showFormError(form, 'Only a version in review can receive a change request.');
    const text = form.elements.text;
    if (text.value.trim().length < 3) return showFormError(form, 'Say what still needs changing.', text);
    p.feedback.push({ id: uid('f'), versionId: v.id, role: 'client', area: 'General', text: text.value.trim(), link: null, status: 'open', createdAt: today() });
    v.status = 'changes_requested';
    commit(`Changes requested. Your note is attached to ${versionLabel(v)}, which stays as it was.`);
  },

  decision(form) {
    const p = currentProject(); if (!p) return;
    const empty = firstEmpty(form);
    if (empty) return showFormError(form, 'Fill in the title, the decision, what changes, what stays and why.', empty);
    const data = new FormData(form);
    const sources = data.getAll('sources');
    const firstSource = p.feedback.find(f => f.id === sources[0]);
    const d = {
      id: uid('d'), num: p.decisions.reduce((m, x) => Math.max(m, x.num), 0) + 1,
      title: data.get('title').trim(), statement: data.get('statement').trim(),
      changes: lines(data.get('changes')), stays: lines(data.get('stays')), why: data.get('why').trim(),
      sources, versionId: firstSource ? firstSource.versionId : (latestVersion(p) || {}).id || null,
      status: 'proposed', agreements: {}, createdAt: today()
    };
    sources.forEach(id => { const f = p.feedback.find(x => x.id === id); if (f && f.status === 'open') f.status = 'in_decision'; });
    p.decisions.push(d);
    form.closest('dialog').close();
    location.hash = `#/p/${p.id}/decisions`;
    commit(`Decision ${pad(d.num)} proposed. Both of you need to agree to it.`);
  }
};

/* ---------- Dialogs ---------- */
function openProjectDialog() {
  const dlg = $('#dlg-project');
  const form = $('form', dlg);
  form.reset(); clearFormError(form);
  dlg.showModal();
  $('#f-name').focus();
}

function openDecisionDialog(p, feedbackId) {
  const dlg = $('#dlg-decision');
  const form = $('form', dlg);
  form.reset(); clearFormError(form);
  const candidates = p.feedback.filter(f => f.role === 'client' && f.status === 'open');
  $('#dlg-decision-sources').innerHTML = candidates.length
    ? candidates.map(f => {
        const v = versionById(p, f.versionId);
        return `<label class="check"><input type="checkbox" name="sources" value="${f.id}"${f.id === feedbackId ? ' checked' : ''}><span>“${esc(f.text)}” <span class="meta">${esc(f.area)} · ${v ? versionLabel(v) : ''}</span></span></label>`;
      }).join('')
    : '<p class="muted">No open feedback. You can still record a decision on its own.</p>';
  $('#dlg-decision-eyebrow').textContent = `Decision ${pad(p.decisions.reduce((m, x) => Math.max(m, x.num), 0) + 1)}`;
  dlg.showModal();
  $('#d-title').focus();
}

/* ---------- Event wiring ---------- */
document.addEventListener('click', event => {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  if (el.getAttribute('aria-disabled') === 'true') {
    toast('Finish reviewing the current version before starting a new one.', 'error');
    return;
  }
  const handler = ACTIONS[el.dataset.action];
  if (handler) { event.preventDefault(); handler(el); }
});

document.addEventListener('submit', event => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  clearFormError(form);
  const handler = FORMS[form.dataset.form];
  if (handler) handler(form);
});

// Clicking the dark backdrop closes a dialog.
document.querySelectorAll('dialog').forEach(dlg => {
  dlg.addEventListener('click', event => { if (event.target === dlg) dlg.close(); });
});

window.addEventListener('hashchange', render);
render();