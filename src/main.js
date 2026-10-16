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
import { openPicker } from './ui/picker.js';
import { h, plural } from './ui/dom.js';
import { toast } from './ui/components.js';
import { CATALOG_VERSION, catalogToMerge } from './data/catalog.js';

initTheme();
registerServiceWorker();

route('/', gamesView, { tab: 'games' });
route('/jeu/nouveau', () => gameFormView({}), { tab: 'games' });
route('/jeu/:id/modifier', gameFormView, { tab: 'games' });
route('/jeu/:id', gameDetailView, { tab: 'games' });
route('/parties', sessionsView, { tab: 'sessions' });
route('/partie/nouvelle', newSessionView, { tab: 'sessions' });
route('/partie/:id', playView, { tab: 'sessions' });
route('/joueurs', playersView, { tab: 'players' });
route('/joueur/:id', playerDetailView, { tab: 'players' });
route('/plus', moreView, { tab: 'more' });
route('/des', diceView, { tab: 'games' });
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
  const stats = store.applyRemote({ games: catalogToMerge(store.list('games', { includeDeleted: true })) }, 'catalog');
  try {
    localStorage.setItem(CATALOG_KEY, String(CATALOG_VERSION));
  } catch {
    /* ignoré */
  }
  const { added, updated } = stats.games;
  let msg = null;
  if (added > 0) msg = `${plural(added, 'jeu de la maison ajouté', 'jeux de la maison ajoutés')} à la ludothèque.`;
  else if (updated > 0) msg = `Nouvelles vignettes pour ${plural(updated, 'jeu', 'jeux')} 🎨`;
  if (msg) setTimeout(() => toast(msg), 600);
}

initStore().then((store) => {
  applyCatalog(store);
  startRouter();
});
