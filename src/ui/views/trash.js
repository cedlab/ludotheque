// Corbeille : éléments supprimés, restaurables ou supprimables définitivement.
import { store, refresh } from '../../app.js';
import { formatDate, h } from '../dom.js';
import { avatar, confirmDialog, emptyState, gameLogo, header, toast } from '../components.js';
import { icon } from '../icons.js';

const SECTIONS = [
  { col: 'players', title: 'Joueurs', label: (r) => r.name, visual: (r) => avatar(r, 40) },
  { col: 'games', title: 'Jeux', label: (r) => r.name, visual: (r) => gameLogo(r, 40) },
  { col: 'sessions', title: 'Parties', label: (r) => `${r.gameName || 'Partie'} · ${formatDate(r.endedAt || r.startedAt)}`, visual: () => null },
];

export function deletedCount() {
  return SECTIONS.reduce((n, s) => n + store.list(s.col, { includeDeleted: true }).filter((r) => r.deleted && !r.purged).length, 0);
}

export function trashView() {
  const sections = SECTIONS.map((s) => ({
    ...s,
    items: store.list(s.col, { includeDeleted: true }).filter((r) => r.deleted && !r.purged).sort((a, b) => b.updatedAt - a.updatedAt),
  })).filter((s) => s.items.length);

  return h('div', null,
    header('Corbeille', { back: '#/plus' }),
    h('p', { class: 'muted small pad-x' }, 'Les éléments supprimés restent ici. « Restaurer » les remet en place, y compris sur les autres téléphones au prochain partage.'),
    sections.length > 0 && h('div', { class: 'pad-x' },
      h('button', { class: 'btn danger-ghost', onclick: async () => {
        const total = sections.reduce((n, s) => n + s.items.length, 0);
        if (!(await confirmDialog(`Supprimer définitivement les ${total} éléments de la corbeille ? Ils ne pourront plus être restaurés.`, { ok: 'Vider la corbeille', danger: true }))) return;
        for (const s of sections) store.purge(s.col, s.items.map((r) => r.id));
        toast('Corbeille vidée.');
        refresh();
      } }, icon('trash'), 'Vider la corbeille')),
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
            } }, 'Restaurer'),
            h('button', { class: 'icon-btn flat', 'aria-label': `Supprimer définitivement ${s.label(r)}`, onclick: async () => {
              if (!(await confirmDialog(`Supprimer définitivement « ${s.label(r)} » ? Il ne pourra plus être restauré.`, { ok: 'Supprimer', danger: true }))) return;
              store.purge(s.col, [r.id]);
              refresh();
            } }, icon('trash', 20))))))));
}
