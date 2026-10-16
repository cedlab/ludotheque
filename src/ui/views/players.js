// Profils joueurs : liste, fiche (statistiques, historique), édition.
import { store, navigate, refresh } from '../../app.js';
import { h, plural, setChildren } from '../dom.js';
import { icon } from '../icons.js';
import { AVATARS, PLAYER_COLORS, avatar, confirmDialog, emptyState, header, sheet, toast } from '../components.js';
import { computeStats, filterHistory } from '../../logic/stats.js';
import { sessionRow } from './sessions.js';

export const sortedPlayers = () => store.list('players').sort((a, b) => a.name.localeCompare(b.name, 'fr'));

/** Feuille d'édition d'un joueur. Retourne une promesse du joueur enregistré (ou null). */
export function editPlayer(existing = null) {
  return new Promise((resolve) => {
    const used = new Set(store.list('players').map((p) => p.color));
    const p = {
      name: '',
      color: PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[0],
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      ...(existing ? structuredClone(existing) : {}),
    };
    let saved = null;
    const preview = h('div', { class: 'player-preview' });
    const showPreview = () => setChildren(preview, avatar(p, 88));
    showPreview();

    const name = h('input', { class: 'input big', type: 'text', value: p.name, placeholder: 'Prénom', maxlength: '30',
      autocomplete: 'off', 'aria-label': 'Prénom', oninput: () => (p.name = name.value) });

    const colorRow = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Couleur' });
    const drawColors = () => setChildren(colorRow, ...PLAYER_COLORS.map((c) =>
      h('button', { type: 'button', class: `swatch ${p.color === c ? 'on' : ''}`, style: { '--c': c }, 'aria-label': `Couleur ${c}`,
        onclick: () => { p.color = c; drawColors(); showPreview(); } })));
    drawColors();

    const avatarRow = h('div', { class: 'emoji-grid', role: 'radiogroup', 'aria-label': 'Avatar' });
    const drawAvatars = () => setChildren(avatarRow, ...AVATARS.map((a) =>
      h('button', { type: 'button', class: `emoji-btn ${p.avatar === a ? 'on' : ''}`, onclick: () => { p.avatar = a; drawAvatars(); showPreview(); } }, a)));
    drawAvatars();

    const s = sheet(
      h('form', { class: 'stack', onsubmit: (e) => {
        e.preventDefault();
        p.name = name.value.trim();
        if (!p.name) { name.focus(); return; }
        saved = store.save('players', p);
        s.close();
      } },
      preview, name,
      h('h4', null, 'Couleur'), colorRow,
      h('h4', null, 'Avatar'), avatarRow,
      h('button', { class: 'btn primary big', type: 'submit' }, icon('check'), 'Enregistrer')),
      { title: existing ? 'Modifier le joueur' : 'Nouveau joueur', onClose: () => resolve(saved) },
    );
    if (!existing) setTimeout(() => name.focus(), 100);
  });
}

export function playersView() {
  const players = sortedPlayers();
  const stats = computeStats({ sessions: store.list('sessions'), games: store.list('games') });
  const add = async () => { if (await editPlayer()) refresh(); };

  return h('div', null,
    header('Joueurs', { actions: [h('button', { class: 'icon-btn', 'aria-label': 'Ajouter un joueur', onclick: add }, icon('plus'))] }),
    players.length === 0
      ? emptyState('🧑‍🤝‍🧑', 'Aucun joueur', 'Créez un profil pour chaque membre de la famille.',
          h('button', { class: 'btn primary big', onclick: add }, icon('plus'), 'Ajouter un joueur'))
      : h('ul', { class: 'list cards' }, players.map((p) => {
          const st = stats.players[p.id];
          const wins = (st?.wins || 0) + (st?.coopWins || 0);
          const played = (st?.played || 0) + (st?.coopPlayed || 0);
          return h('li', null, h('a', { class: 'row-link', href: `#/joueur/${p.id}` },
            avatar(p, 48),
            h('span', { class: 'grow' }, h('strong', null, p.name),
              h('small', { class: 'muted' }, played ? `${plural(wins, 'victoire', 'victoires')} sur ${plural(played, 'partie', 'parties')}` : 'Pas encore de partie')),
            st?.currentStreak >= 2 && h('span', { class: 'badge flame' }, icon('flame', 16), st.currentStreak)));
        })),
    players.length > 0 && h('div', { class: 'pad' }, h('button', { class: 'btn ghost', onclick: add }, icon('plus'), 'Ajouter un joueur')));
}

export function playerDetailView({ id }) {
  const p = store.get('players', id);
  if (!p) return h('div', null, header('Joueur introuvable', { back: '#/joueurs' }), emptyState('🤷', 'Ce joueur n’existe plus'));
  const sessions = store.list('sessions');
  const stats = computeStats({ sessions, games: store.list('games') });
  const st = stats.players[id] || { played: 0, wins: 0, coopPlayed: 0, coopWins: 0, currentStreak: 0, bestStreak: 0 };
  const history = filterHistory(sessions, { playerId: id });

  // Jeu préféré (le plus joué) et meilleurs scores détenus
  const counts = {};
  for (const s of history) counts[s.gameName] = (counts[s.gameName] || 0) + 1;
  const fav = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const records = stats.bestScores.filter((b) => b.holders.includes(p.name));

  const edit = async () => { if (await editPlayer(p)) refresh(); };
  const remove = async () => {
    if (await confirmDialog(`Supprimer le profil de ${p.name} ? Ses parties restent dans l’historique.`, { ok: 'Supprimer', danger: true })) {
      store.remove('players', id);
      toast(`${p.name} supprimé.`);
      navigate('/joueurs', { replace: true });
    }
  };
  const rate = st.played ? Math.round((st.wins / st.played) * 100) : 0;

  return h('div', null,
    header(p.name, { back: '#/joueurs', actions: [h('button', { class: 'icon-btn', 'aria-label': 'Modifier', onclick: edit }, icon('edit'))] }),
    h('section', { class: 'player-hero', style: { '--c': p.color } }, avatar(p, 96), h('h2', null, p.name)),
    h('div', { class: 'stat-grid' },
      statTile('🏆', st.wins, plural(st.wins, 'victoire', 'victoires').replace(/^\d+ /, '')),
      statTile('🎲', st.played, 'parties'),
      statTile('📈', `${rate} %`, 'de réussite'),
      statTile('🔥', st.bestStreak, 'meilleure série'),
      st.coopPlayed > 0 && statTile('🤝', `${st.coopWins}/${st.coopPlayed}`, 'coop gagnées'),
      fav && statTile('❤️', fav[0], 'jeu préféré', true)),
    records.length > 0 && h('section', { class: 'card' }, h('h3', null, 'Records détenus'),
      h('ul', { class: 'list' }, records.map((r) => h('li', { class: 'row' }, h('span', { class: 'grow' }, r.name), h('strong', null, r.value))))),
    h('section', { class: 'card' }, h('h3', null, 'Historique'),
      history.length === 0 ? h('p', { class: 'muted' }, 'Aucune partie jouée.') : h('ul', { class: 'list' }, history.slice(0, 30).map((s) => sessionRow(s, { highlight: id })))),
    h('div', { class: 'pad' }, h('button', { class: 'btn danger-ghost', onclick: remove }, icon('trash'), 'Supprimer ce joueur')));
}

export function statTile(emoji, value, label, wide = false) {
  return h('div', { class: `stat-tile ${wide ? 'wide' : ''}` },
    h('span', { class: 'stat-emoji' }, emoji), h('strong', null, String(value)), h('small', null, label));
}
