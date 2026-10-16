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
import { h } from './ui/dom.js';

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

initStore().then(startRouter);
