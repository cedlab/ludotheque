// Corbeille : éléments supprimés, restaurables.
import { store, refresh } from '../../app.js';
import { formatDate, h } from '../dom.js';
import { avatar, emptyState, gameLogo, header, toast } from '../components.js';

const SECTIONS = [
  { col: 'players', title: 'Joueurs', label: (r) => r.name, visual: (r) => avatar(r, 40) },
  { col: 'games', title: 'Jeux', label: (r) => r.name, visual: (r) => gameLogo(r, 40) },
  { col: 'sessions', title: 'Parties', label: (r) => `${r.gameName || 'Partie'} · ${formatDate(r.endedAt || r.startedAt)}`, visual: () => null },
];

export function deletedCount() {
  return SECTIONS.reduce((n, s) => n + store.list(s.col, { includeDeleted: true }).filter((r) => r.deleted).length, 0);
}

export function trashView() {
  const sections = SECTIONS.map((s) => ({
    ...s,
    items: store.list(s.col, { includeDeleted: true }).filter((r) => r.deleted).sort((a, b) => b.updatedAt - a.updatedAt),
  })).filter((s) => s.items.length);

  return h('div', null,
    header('Corbeille', { back: '#/plus' }),
    h('p', { class: 'muted small pad-x' }, 'Les éléments supprimés restent ici. « Restaurer » les remet en place, y compris sur les autres téléphones au prochain partage.'),
    sections.length === 0
      ? emptyState('🗑️', 'La corbeille est vide')
      : sections.map((s) => h('section', { class: 'card' },
          h('h3', null, `${s.title} (${s.items.length})`),
          h('ul', { class: 'list' }, s.items.map((r) => h('li', { class: 'row' },
            s.visual(r),
            h('span', { class: 'grow col' }, h('strong', null, s.label(r)), h('small', { class: 'muted' }, `Supprimé le ${formatDate(r.updatedAt)}`)),
            h('button', { class: 'btn small', onclick: () => {
              store.restore(s.col, r.id);
              toast(`${s.label(r)} restauré.`);
              refresh();
            } }, 'Restaurer')))))));
}
