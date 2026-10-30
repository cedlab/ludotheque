import './styles.css';
import { initStore, route, startRouter } from './app.js';
import { registerServiceWorker } from './pwa.js';
import { initTheme } from './theme.js';
import { gameDetailView, gamesView } from './ui/views/games.js';
import { gameFormView } from './ui/views/game-form.js';
import { playerDetailView, playersView } from './ui/views/players.js';
import { newSessionView, playView, sessionsView } from './ui/views/sessions.js';
import { moreView } from './ui/views/more.js';
import { diceView } from './ui/views/dice.js';
import { trashView } from './ui/views/trash.js';
import { joinView } from './ui/views/sync.js';
import { startSync } from './sync/index.js';
import { openPicker } from './ui/picker.js';
import { h, plural } from './ui/dom.js';
import { toast } from './ui/components.js';
import { CATALOG_VERSION, catalogToMerge } from './data/catalog.js';
import { migrateLegacyFavorites } from './logic/favorites.js';

initTheme();
registerServiceWorker();

route('/', gamesView, { tab: 'games' });
route('/jeu/nouveau', (_, query) => gameFormView({}, query), { tab: 'games' });
route('/jeu/:id/modifier', gameFormView, { tab: 'games' });
route('/jeu/:id', gameDetailView, { tab: 'games' });
route('/parties', sessionsView, { tab: 'sessions' });
route('/partie/nouvelle', newSessionView, { tab: 'sessions' });
route('/partie/:id', playView, { tab: 'sessions' });
route('/joueurs', playersView, { tab: 'players' });
route('/joueur/:id', playerDetailView, { tab: 'players' });
route('/plus', moreView, { tab: 'more' });
route('/des', diceView, { tab: 'games' });
route('/corbeille', trashView, { tab: 'more' });
route('/rejoindre', joinView, { tab: 'more' });
route('/tirage', () => {
  // Écran plein écran ; en le fermant on revient à la page précédente.
  let closedByRoute = false;
  const close = openPicker({
    onClose: () => {
      if (!closedByRoute) history.length > 1 ? history.back() : (location.hash = '#/');
    },
  });
  return {
    el: h('div', { class: 'picker-placeholder' }),
    cleanup: () => {
      closedByRoute = true;
      close();
    },
  };
}, { tab: 'picker' });

const CATALOG_KEY = 'ludo.catalog';

/** Ajoute les jeux de la maison (une fois par version du catalogue). */
function applyCatalog(store) {
  let applied = 0;
  try {
    applied = Number(localStorage.getItem(CATALOG_KEY)) || 0;
  } catch {
    /* stockage indisponible : on applique quand même, la fusion évite les doublons */
  }
  if (applied >= CATALOG_VERSION) return;
  const before = new Set(store.list('games', { includeDeleted: true }).map((g) => g.id));
  const incoming = catalogToMerge(store.list('games', { includeDeleted: true }));
  // Nouveaux jeux rangés dans « À tester » (idées à essayer), signalés à part.
  const toTest = incoming.filter((g) => !before.has(g.id) && !g.deleted && g.status === 'totest').length;
  const stats = store.applyRemote({ games: incoming }, 'catalog');
  try {
    localStorage.setItem(CATALOG_KEY, String(CATALOG_VERSION));
  } catch {
    /* ignoré */
  }
  const { added, updated, deleted } = stats.games;
  const parts = [];
  if (added - toTest > 0) parts.push(`${plural(added - toTest, 'jeu ajouté', 'jeux ajoutés')}`);
  if (toTest > 0) parts.push(`${plural(toTest, 'idée', 'idées')} de jeu dans « À tester »`);
  if (deleted > 0) parts.push(`${plural(deleted, 'jeu retiré', 'jeux retirés')}`);
  if (!parts.length && updated > 0) parts.push(`${plural(updated, 'jeu mis', 'jeux mis')} à jour`);
  if (parts.length) setTimeout(() => toast(`Ludothèque de la maison : ${parts.join(', ')}.`), 600);
}

/**
 * Les anciens cœurs (favoris communs) deviennent les favoris d'Aurélie. Refait
 * après chaque réception de données : un autre téléphone peut en envoyer
 * avant d'avoir été mis à jour, ou le profil d'Aurélie peut arriver plus tard.
 */
function migrateFavorites(store) {
  const games = store.list('games');
  for (const g of migrateLegacyFavorites(games, store.list('players'))) store.save('games', g);
}

initStore().then((store) => {
  applyCatalog(store);
  migrateFavorites(store);
  store.subscribe(({ source }) => {
    if (source === 'external') queueMicrotask(() => migrateFavorites(store));
  });
  startRouter();
  startSync(store);
});
