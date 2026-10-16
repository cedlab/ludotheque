// État global de l'application et routeur (#/chemin).
import { Store } from './data/store.js';
import { IndexedDBBackend, MemoryBackend } from './data/backends.js';
import { h, setChildren } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { toast } from './ui/components.js';

/** @type {Store} */
export let store;

export async function initStore() {
  try {
    store = await new Store(new IndexedDBBackend()).init();
  } catch (e) {
    console.error(e);
    store = await new Store(new MemoryBackend()).init();
    setTimeout(() => toast('Stockage indisponible (navigation privée ?) : les données ne seront pas conservées.', { duration: 8000 }), 500);
  }
  // Demande un stockage persistant (évite l'effacement automatique par le navigateur).
  navigator.storage?.persist?.().catch(() => {});
  return store;
}

// --- Routeur -----------------------------------------------------------------

const routes = [];
let current = null;

/** Déclare une route : pattern '/jeu/:id', vue (params, query) => Element. */
export function route(pattern, view, { tab } = {}) {
  const keys = [];
  const re = new RegExp(
    `^${pattern.replace(/\/:(\w+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; })}/?$`,
  );
  routes.push({ re, keys, view, tab });
}

export function navigate(path, { replace = false } = {}) {
  const hash = `#${path}`;
  if (replace) history.replaceState(null, '', hash);
  else if (location.hash !== hash) history.pushState(null, '', hash);
  render();
}

export function back(fallback = '/') {
  if (history.length > 1) history.back();
  else navigate(fallback, { replace: true });
}

function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

const TABS = [
  { id: 'games', href: '#/', label: 'Jeux', icon: 'dice' },
  { id: 'sessions', href: '#/parties', label: 'Parties', icon: 'trophy' },
  { id: 'picker', href: '#/tirage', label: 'Tirage', icon: 'hand', center: true },
  { id: 'players', href: '#/joueurs', label: 'Joueurs', icon: 'users' },
  { id: 'more', href: '#/plus', label: 'Plus', icon: 'more' },
];

function tabbar(active) {
  return h('nav', { class: 'tabbar', 'aria-label': 'Navigation principale' },
    TABS.map((t) =>
      h('a', {
        href: t.href,
        class: `tab ${t.center ? 'tab-center' : ''} ${active === t.id ? 'on' : ''}`,
        'aria-current': active === t.id ? 'page' : undefined,
      }, h('span', { class: 'tab-icon' }, icon(t.icon, t.center ? 28 : 24)), h('span', { class: 'tab-label' }, t.label))));
}

export function render() {
  const { path, query } = parse();
  const app = document.getElementById('app');
  if (current?.cleanup) current.cleanup();
  for (const r of routes) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const result = r.view(params, query);
    const el = result instanceof Node ? result : result.el;
    current = { cleanup: result.cleanup, path };
    const main = h('main', { class: 'view' }, el);
    setChildren(app, main, r.tab !== null ? tabbar(r.tab) : null);
    app.classList.toggle('no-tabs', r.tab === null);
    window.scrollTo(0, 0);
    return;
  }
  navigate('/', { replace: true });
}

/** Re-rendu sans remonter en haut de page (après une modification). */
export function refresh() {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  // Données reçues d'ailleurs (import, exemples) : on rafraîchit la vue.
  store.subscribe(({ source }) => {
    if (source === 'external') refresh();
  });
  render();
}
