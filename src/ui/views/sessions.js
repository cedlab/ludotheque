// Parties : création, saisie des scores, résultats, historique, statistiques.
import { store, navigate, refresh } from '../../app.js';
import { formatDate, formatDuration, h, plural, secureRandom, vibrate, setChildren } from '../dom.js';
import { icon } from '../icons.js';
import {
  avatar, confirmDialog, emptyState, gameLogo, header, promptNumber, segmented, sheet, toast,
} from '../components.js';
import {
  COUNTDOWN_WIN, MODES, computeResult, describeScoring, entrantIds, normalizeScoring, randomTeams, totals,
} from '../../logic/scoring.js';
import { computeStats, filterHistory, sessionWinners } from '../../logic/stats.js';
import { TEAM_COLORS, TEAM_NAMES } from '../../logic/picker-engine.js';
import { openPicker } from '../picker.js';
import { editPlayer, sortedPlayers, statTile } from './players.js';
import { gameMeta, sortedGames } from './games.js';
import { uuid } from '../../data/records.js';

// --- Aides ---------------------------------------------------------------------

const liveGameName = (s) => store.get('games', s.gameId)?.name || s.gameName || 'Jeu supprimé';
const liveGame = (s) => store.get('games', s.gameId) || { name: s.gameName || '?', logo: null };
/** Nom affiché d'un joueur d'une partie : profil actuel s'il existe, sinon l'instantané. */
const livePlayer = (p) => {
  const cur = store.get('players', p.id);
  return cur ? { ...p, name: cur.name, color: cur.color, avatar: cur.avatar } : p;
};

function entrants(s) {
  const sc = normalizeScoring(s.scoring);
  const players = (s.players || []).map(livePlayer);
  if (sc.teams) {
    return (s.teams || []).map((t) => ({
      id: t.id, name: t.name, color: t.color, isTeam: true,
      members: players.filter((p) => p.teamId === t.id),
    }));
  }
  return players.map((p) => ({ ...p, isTeam: false }));
}

const entrantBadge = (e, size = 44) =>
  e.isTeam
    ? h('span', { class: 'avatar team', style: { width: `${size}px`, height: `${size}px`, '--c': e.color } },
        e.members.slice(0, 3).map((m) => h('span', null, m.avatar || m.name[0])))
    : avatar(e, size);

const MEDALS = ['🥇', '🥈', '🥉'];

/** Ligne d'historique réutilisée dans les fiches jeu et joueur. */
export function sessionRow(s, { showGame = true, highlight = null } = {}) {
  const sc = normalizeScoring(s.scoring);
  const result = computeResult(sc, s);
  const winners = sessionWinners(s);
  const names = (ids) => (s.players || []).filter((p) => ids.includes(p.id)).map((p) => livePlayer(p).name);
  let summary;
  if (sc.mode === MODES.COOP) summary = result.coop?.result === 'win' ? '🤝 Victoire collective' : '💀 Défaite collective';
  else if (result.tie) summary = `🤝 Égalité : ${names(winners).join(', ')}`;
  else summary = `🏆 ${names(winners).join(', ') || '—'}`;
  const won = highlight && winners.includes(highlight);
  return h('li', null, h('a', { class: `row-link ${won ? 'won' : ''}`, href: `#/partie/${s.id}` },
    showGame && gameLogo(liveGame(s), 40),
    h('span', { class: 'grow' },
      h('strong', null, showGame ? liveGameName(s) : formatDate(s.endedAt || s.startedAt)),
      h('small', { class: 'muted' }, showGame ? `${formatDate(s.endedAt || s.startedAt)} · ${summary}` : summary))));
}

// --- Liste des parties : en cours, historique, statistiques --------------------

export function sessionsView(_, query) {
  const tab = query.onglet === 'stats' ? 'stats' : 'history';
  const sessions = store.list('sessions');
  const playing = sessions.filter((s) => s.status === 'playing').sort((a, b) => b.updatedAt - a.updatedAt);
  const body = h('div');

  const draw = (t) => {
    history.replaceState(null, '', t === 'stats' ? '#/parties?onglet=stats' : '#/parties');
    setChildren(body, t === 'stats' ? statsPanel(sessions) : historyPanel(sessions, query));
  };
  draw(tab);

  return h('div', null,
    header('Parties'),
    h('div', { class: 'stack pad-x' },
      h('a', { class: 'btn primary big', href: '#/partie/nouvelle' }, icon('plus'), 'Nouvelle partie')),
    playing.length > 0 && h('section', { class: 'card' },
      h('h3', null, 'En cours'),
      h('ul', { class: 'list' }, playing.map((s) => h('li', null, h('a', { class: 'row-link', href: `#/partie/${s.id}` },
        gameLogo(liveGame(s), 40),
        h('span', { class: 'grow' }, h('strong', null, liveGameName(s)),
          h('small', { class: 'muted' }, `${(s.players || []).map((p) => livePlayer(p).name).join(', ')}`)),
        h('span', { class: 'badge' }, 'Reprendre')))))),
    h('div', { class: 'pad-x' }, segmented([{ value: 'history', label: 'Historique' }, { value: 'stats', label: 'Statistiques' }], tab, draw)),
    body);
}

function historyPanel(sessions) {
  const f = { gameId: '', playerId: '' };
  const list = h('div');
  const gameSel = h('select', { class: 'chip-select', 'aria-label': 'Filtrer par jeu', onchange: () => { f.gameId = gameSel.value; draw(); } },
    h('option', { value: '' }, 'Tous les jeux'), sortedGames().map((g) => h('option', { value: g.id }, g.name)));
  const playerSel = h('select', { class: 'chip-select', 'aria-label': 'Filtrer par joueur', onchange: () => { f.playerId = playerSel.value; draw(); } },
    h('option', { value: '' }, 'Tous les joueurs'), sortedPlayers().map((p) => h('option', { value: p.id }, p.name)));
  const draw = () => {
    const items = filterHistory(sessions, { gameId: f.gameId || null, playerId: f.playerId || null });
    gameSel.classList.toggle('on', !!f.gameId);
    playerSel.classList.toggle('on', !!f.playerId);
    setChildren(list, items.length === 0
      ? emptyState('📜', 'Aucune partie terminée', 'Les parties terminées apparaîtront ici.')
      : h('section', { class: 'card' }, h('p', { class: 'muted' }, plural(items.length, 'partie', 'parties')),
          h('ul', { class: 'list' }, items.map((s) => sessionRow(s, { highlight: f.playerId || null })))));
  };
  draw();
  return h('div', null, h('div', { class: 'filters' }, gameSel, playerSel), list);
}

function bar(label, value, max, extra, color) {
  return h('li', { class: 'bar-row' },
    h('span', { class: 'bar-label' }, label),
    h('span', { class: 'bar-track' }, h('span', { class: 'bar-fill', style: { width: `${max ? Math.max(4, (value / max) * 100) : 0}%`, '--c': color || 'var(--primary)' } })),
    h('strong', { class: 'bar-value' }, extra ?? String(value)));
}

function statsPanel(sessions) {
  const stats = computeStats({ sessions, games: store.list('games') });
  if (stats.totalSessions === 0) return emptyState('📊', 'Pas encore de statistiques', 'Jouez quelques parties pour voir qui domine la table !');
  const players = sortedPlayers();
  const rows = players.map((p) => ({ p, st: stats.players[p.id] })).filter((r) => r.st);
  rows.sort((a, b) => b.st.wins + b.st.coopWins - (a.st.wins + a.st.coopWins));
  const maxWins = Math.max(1, ...rows.map((r) => r.st.wins));
  const maxCount = Math.max(1, ...stats.games.map((g) => g.count));
  const streakers = rows.filter((r) => r.st.bestStreak > 0).sort((a, b) => b.st.bestStreak - a.st.bestStreak);
  const competitive = rows.filter((r) => r.st.played > 0);

  return h('div', null,
    h('div', { class: 'stat-grid' },
      statTile('🎲', stats.totalSessions, 'parties jouées'),
      statTile('📚', stats.games.length, 'jeux différents'),
      rows[0] && statTile('👑', rows[0].p.name, 'le plus de victoires', true)),
    competitive.length > 0 && h('section', { class: 'card' }, h('h3', null, '🏆 Victoires par joueur'),
      h('ul', { class: 'bars' }, competitive.map(({ p, st }) =>
        bar(`${p.avatar || ''} ${p.name}`, st.wins, maxWins, `${st.wins} / ${st.played}`, p.color)))),
    h('section', { class: 'card' }, h('h3', null, '🎲 Jeux les plus joués'),
      h('ul', { class: 'bars' }, stats.games.slice(0, 10).map((g) => bar(g.name, g.count, maxCount)))),
    stats.bestScores.length > 0 && h('section', { class: 'card' }, h('h3', null, '⭐ Meilleur score par jeu'),
      h('ul', { class: 'list' }, stats.bestScores.map((b) => h('li', { class: 'row' },
        h('span', { class: 'grow' }, h('strong', null, b.name), h('small', { class: 'muted' }, b.holders.join(', '))),
        h('strong', { class: 'score-pill' }, b.mode === MODES.LOWEST ? `↓ ${b.value}` : b.value))))),
    streakers.length > 0 && h('section', { class: 'card' }, h('h3', null, '🔥 Séries de victoires'),
      h('ul', { class: 'list' }, streakers.map(({ p, st }) => h('li', { class: 'row' },
        avatar(p, 32), h('span', { class: 'grow' }, p.name),
        h('small', { class: 'muted' }, st.currentStreak > 0 ? `en cours : ${st.currentStreak}` : ''),
        h('strong', { class: 'score-pill' }, `record ${st.bestStreak}`))))),
    rows.some((r) => r.st.coopPlayed) && h('section', { class: 'card' }, h('h3', null, '🤝 Jeux coopératifs'),
      h('ul', { class: 'list' }, rows.filter((r) => r.st.coopPlayed).map(({ p, st }) => h('li', { class: 'row' },
        avatar(p, 32), h('span', { class: 'grow' }, p.name), h('strong', null, `${st.coopWins} / ${st.coopPlayed}`))))));
}

// --- Nouvelle partie ----------------------------------------------------------------

function lastPlayersFor(gameId) {
  const all = store.list('sessions').sort((a, b) => b.updatedAt - a.updatedAt);
  const s = all.find((x) => x.gameId === gameId) || all[0];
  return (s?.players || []).map((p) => p.id).filter((id) => store.get('players', id));
}

export function newSessionView(_, query) {
  const state = { gameId: query.jeu || null, selected: [], teamCount: 2, teamOf: {} };
  if (state.gameId && !store.get('games', state.gameId)) state.gameId = null;
  if (state.gameId) state.selected = lastPlayersFor(state.gameId);
  const wrap = h('div');

  const assignTeams = () => {
    const teams = randomTeams(state.selected, state.teamCount, secureRandom);
    state.teamOf = {};
    teams.forEach((ids, i) => ids.forEach((id) => (state.teamOf[id] = i)));
  };
  const ensureTeams = () => {
    for (const id of state.selected) {
      if (!(id in state.teamOf) || state.teamOf[id] >= state.teamCount) {
        // place dans l'équipe la moins remplie
        const counts = Array.from({ length: state.teamCount }, (_, i) => state.selected.filter((x) => state.teamOf[x] === i).length);
        state.teamOf[id] = counts.indexOf(Math.min(...counts));
      }
    }
  };

  const start = () => {
    const game = store.get('games', state.gameId);
    const sc = normalizeScoring(game.scoring);
    if (state.selected.length === 0) return toast('Choisissez au moins un joueur.');
    let teams = [];
    if (sc.teams) {
      ensureTeams();
      teams = Array.from({ length: state.teamCount }, (_, i) => ({ id: uuid(), name: TEAM_NAMES[i], color: TEAM_COLORS[i] }))
        .filter((_, i) => state.selected.some((id) => state.teamOf[id] === i));
      if (teams.length < 2) return toast('Il faut au moins deux équipes avec des joueurs.');
    }
    const teamIdOf = (pid) => (sc.teams ? teams.find((t) => t.name === TEAM_NAMES[state.teamOf[pid]])?.id : null);
    const s = store.save('sessions', {
      gameId: game.id,
      gameName: game.name,
      scoring: sc,
      players: state.selected.map((id) => {
        const p = store.get('players', id);
        return { id: p.id, name: p.name, color: p.color, avatar: p.avatar, teamId: teamIdOf(id) ?? null };
      }),
      teams,
      rounds: sc.rounds ? [{}] : [],
      finals: {},
      coop: { result: null, score: 0 },
      status: 'playing',
      startedAt: Date.now(),
      endedAt: null,
    });
    navigate(`/partie/${s.id}`, { replace: true });
  };

  const draw = () => {
    const game = state.gameId ? store.get('games', state.gameId) : null;
    const players = sortedPlayers();
    const sc = game ? normalizeScoring(game.scoring) : null;
    const n = state.selected.length;
    let warn = null;
    if (game && n > 0 && game.minPlayers && n < game.minPlayers) warn = `${game.name} se joue à partir de ${game.minPlayers} joueurs.`;
    if (game && game.maxPlayers && n > game.maxPlayers) warn = `${game.name} se joue jusqu’à ${game.maxPlayers} joueurs.`;
    if (sc?.teams) ensureTeams();

    setChildren(wrap, 
      header('Nouvelle partie', { back: '#/parties' }),
      // 1. Jeu
      h('section', { class: 'card' },
        h('h3', null, '1. Le jeu'),
        game
          ? h('button', { class: 'row-link plain', onclick: () => { state.gameId = null; draw(); } },
              gameLogo(game, 56),
              h('span', { class: 'grow' }, h('strong', null, game.name), h('small', { class: 'muted' }, describeScoring(game.scoring))),
              h('span', { class: 'link' }, 'Changer'))
          : sortedGames().length === 0
            ? h('p', null, 'Aucun jeu. ', h('a', { href: '#/jeu/nouveau' }, 'Ajouter un jeu'))
            : h('ul', { class: 'game-grid compact' }, sortedGames().map((g) => h('li', null,
                h('button', { class: 'game-card', onclick: () => {
                  state.gameId = g.id;
                  if (state.selected.length === 0) state.selected = lastPlayersFor(g.id);
                  draw();
                } }, gameLogo(g, 56), h('span', { class: 'game-name' }, g.name), h('span', { class: 'game-meta' }, gameMeta(g))))))),
      // 2. Joueurs
      game && h('section', { class: 'card' },
        h('h3', null, `2. Les joueurs ${n ? `(${n})` : ''}`),
        h('div', { class: 'chips' },
          players.map((p) => {
            const on = state.selected.includes(p.id);
            return h('button', { class: `player-chip ${on ? 'on' : ''}`, style: { '--c': p.color }, 'aria-pressed': String(on),
              onclick: () => {
                state.selected = on ? state.selected.filter((x) => x !== p.id) : [...state.selected, p.id];
                draw();
              } }, avatar(p, 32), p.name, on && icon('check', 18));
          }),
          h('button', { class: 'player-chip add', onclick: async () => {
            const p = await editPlayer();
            if (p) { state.selected.push(p.id); draw(); }
          } }, icon('plus', 18), 'Nouveau')),
        warn && h('p', { class: 'warn' }, '⚠️ ', warn)),
      // 3. Équipes
      game && sc.teams && n > 0 && h('section', { class: 'card stack' },
        h('h3', null, '3. Les équipes'),
        h('div', { class: 'row gap' },
          h('span', { class: 'grow muted' }, 'Nombre d’équipes'),
          segmented([2, 3, 4].map((k) => ({ value: k, label: String(k) })), state.teamCount, (k) => { state.teamCount = k; ensureTeams(); draw(); })),
        h('p', { class: 'muted small' }, 'Touchez un joueur pour le changer d’équipe.'),
        h('ul', { class: 'list' }, state.selected.map((id) => {
          const p = store.get('players', id);
          const t = state.teamOf[id] ?? 0;
          return h('li', null, h('button', { class: 'row-link plain', onclick: () => { state.teamOf[id] = (t + 1) % state.teamCount; draw(); } },
            avatar(p, 36), h('span', { class: 'grow' }, p.name),
            h('span', { class: 'team-tag', style: { '--c': TEAM_COLORS[t] } }, TEAM_NAMES[t])));
        })),
        h('button', { class: 'btn ghost', onclick: () => { assignTeams(); draw(); vibrate(30); } }, icon('shuffle'), 'Répartir au hasard')),
      // Qui commence ?
      game && n > 1 && h('section', { class: 'card stack' },
        h('h3', null, 'Qui commence ?'),
        h('div', { class: 'row gap' },
          h('button', { class: 'btn grow', onclick: () => openPicker() }, icon('hand'), 'Tirage au doigt'),
          h('button', { class: 'btn grow', onclick: () => drawName(state.selected.map((id) => store.get('players', id))) }, icon('dice'), 'Tirer un nom'))),
      game && h('div', { class: 'sticky-actions' },
        h('button', { class: 'btn primary big grow', disabled: n === 0, onclick: start }, icon('play'), 'C’est parti !')),
    );
  };
  draw();
  return wrap;
}

function drawName(players) {
  const p = players[Math.floor(secureRandom() * players.length)];
  vibrate([40, 40, 120]);
  const s = sheet(h('div', { class: 'stack center' },
    h('div', { class: 'pop' }, avatar(p, 120)),
    h('h2', null, p.name),
    h('p', { class: 'muted' }, 'commence la partie !'),
    h('button', { class: 'btn primary big', onclick: () => s.close() }, 'OK')), { title: 'Premier joueur' });
}

// --- Partie en cours / résultats ---------------------------------------------------

const STEPS = [1, 5, 10, 50];
let stepIndex = 0;

export function playView({ id }) {
  const rec = store.get('sessions', id);
  if (!rec) return h('div', null, header('Partie introuvable', { back: '#/parties' }), emptyState('🤷', 'Cette partie n’existe plus'));
  if (rec.status === 'finished') return resultView(rec);

  const s = structuredClone(rec);
  const sc = normalizeScoring(s.scoring);
  const isCountdown = sc.mode === MODES.COUNTDOWN;
  const wrap = h('div', { class: 'play' });
  let saveTimer = null;
  let showRounds = false;

  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = null;
    const saved = store.save('sessions', s);
    s.updatedAt = saved.updatedAt;
  };
  const changed = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
    draw();
  };
  const onHide = () => { if (document.visibilityState === 'hidden' && saveTimer) persist(); };
  document.addEventListener('visibilitychange', onHide);

  // Valeur éditable de l'entrant : manche en cours, ou score final.
  const currentRound = () => {
    if (!s.rounds.length) s.rounds.push({});
    return s.rounds[s.rounds.length - 1];
  };
  const getVal = (eid) => (sc.rounds ? currentRound()[eid] || 0 : s.finals[eid] || 0);
  const setVal = (eid, v) => {
    if (sc.rounds) currentRound()[eid] = v;
    else s.finals[eid] = v;
    changed();
  };
  // En décompte, « − » retire des points restants (donc ajoute aux points déduits).
  const bump = (eid, dir) => {
    const step = STEPS[stepIndex];
    setVal(eid, getVal(eid) + (isCountdown ? -dir : dir) * step);
    vibrate(8);
  };

  const finish = async () => {
    const result = computeResult(sc, s);
    if (sc.mode === MODES.COOP && !result.reached) return toast('Indiquez d’abord si le groupe a gagné ou perdu.');
    if (!result.reached && sc.mode !== MODES.HIGHEST && sc.mode !== MODES.LOWEST) {
      if (!(await confirmDialog('La condition de victoire n’est pas encore atteinte. Terminer quand même ? Le meneur actuel sera déclaré gagnant.', { ok: 'Terminer' }))) return;
    }
    // Retire une dernière manche vide
    if (sc.rounds && s.rounds.length > 1 && Object.values(s.rounds[s.rounds.length - 1]).every((v) => !v)) s.rounds.pop();
    s.status = 'finished';
    s.endedAt = Date.now();
    persist();
    vibrate([60, 40, 200]);
    navigate(`/partie/${id}`, { replace: true });
  };

  const editRoundCell = async (ri, e) => {
    const v = await promptNumber({ title: `${e.name} · manche ${ri + 1}`, value: s.rounds[ri][e.id] || 0,
      hint: isCountdown ? 'Points retirés pendant cette manche.' : null });
    if (v === null) return;
    s.rounds[ri][e.id] = v;
    changed();
  };

  const draw = () => {
    const list = entrants(s);
    const ids = entrantIds(s);
    const tot = totals(sc, s, ids);
    const result = computeResult(sc, s);
    const anyScore = Object.values(tot).some((v) => v !== 0);
    const nameOf = (eid) => list.find((e) => e.id === eid)?.name;

    let banner = null;
    if (sc.mode !== MODES.COOP && result.reached) {
      banner = h('button', { class: 'banner win', onclick: finish },
        result.tie ? `🤝 Égalité : ${result.winners.map(nameOf).join(' et ')} !` : `🎉 ${nameOf(result.winners[0])} a gagné !`,
        h('small', null, 'Toucher pour terminer la partie'));
    }

    const cards = sc.mode === MODES.COOP ? coopPanel() : h('ul', { class: 'score-list' }, list.map((e) => {
      const entry = result.ranking.find((r) => r.id === e.id);
      const display = isCountdown ? sc.startScore - tot[e.id] : tot[e.id];
      const cur = getVal(e.id);
      const leading = anyScore && entry?.rank === 1;
      const out = isCountdown && entry?.eliminated;
      return h('li', { class: `score-card ${leading ? 'leading' : ''} ${out ? 'out' : ''}`, style: { '--c': e.color } },
        h('div', { class: 'score-head' },
          entrantBadge(e, 40),
          h('span', { class: 'score-name' }, e.name, e.isTeam && h('small', null, e.members.map((m) => m.name).join(', '))),
          leading && h('span', { class: 'crown', 'aria-label': 'en tête' }, '👑'),
          h('button', { class: 'score-total', 'aria-label': `Total de ${e.name} : ${display}. Modifier`, onclick: async () => {
            if (sc.rounds) return; // le total se calcule à partir des manches
            const v = await promptNumber({ title: e.name, value: isCountdown ? display : cur,
              hint: isCountdown ? 'Points restants' : null });
            if (v === null) return;
            setVal(e.id, isCountdown ? sc.startScore - v : v);
          } }, String(display))),
        h('div', { class: 'score-controls' },
          h('button', { class: 'big-btn minus', 'aria-label': `${e.name} moins ${STEPS[stepIndex]}`, onclick: () => bump(e.id, -1) }, icon('minus', 32)),
          sc.rounds
            ? h('button', { class: 'round-value', onclick: async () => {
                const v = await promptNumber({ title: `${e.name} · manche ${s.rounds.length}`, value: cur,
                  hint: isCountdown ? 'Points retirés pendant cette manche.' : null });
                if (v !== null) setVal(e.id, v);
              } }, h('small', null, `Manche ${s.rounds.length}`), h('strong', null, isCountdown ? (cur ? `−${cur}` : '0') : (cur > 0 ? `+${cur}` : String(cur))))
            : h('span', { class: 'round-value static' }, h('small', null, isCountdown ? 'restants' : 'points')),
          h('button', { class: 'big-btn plus', 'aria-label': `${e.name} plus ${STEPS[stepIndex]}`, onclick: () => bump(e.id, 1) }, icon('plus', 32))));
    }));

    const roundsTable = sc.rounds && sc.mode !== MODES.COOP && showRounds && h('section', { class: 'card' },
      h('div', { class: 'table-wrap' }, h('table', { class: 'rounds' },
        h('thead', null, h('tr', null, h('th', null, '#'), list.map((e) => h('th', { style: { color: e.color } }, e.name)))),
        h('tbody', null, s.rounds.map((r, ri) => h('tr', null, h('td', null, ri + 1),
          list.map((e) => h('td', null, h('button', { class: 'cell', onclick: () => editRoundCell(ri, e) }, r[e.id] ? (isCountdown ? `−${r[e.id]}` : r[e.id]) : '·')))))),
        h('tfoot', null, h('tr', null, h('td', null, isCountdown ? 'Reste' : 'Total'),
          list.map((e) => h('td', null, isCountdown ? sc.startScore - tot[e.id] : tot[e.id])))))),
      s.rounds.length > 1 && h('button', { class: 'btn small ghost', onclick: async () => {
        if (await confirmDialog(`Supprimer la manche ${s.rounds.length} ?`, { ok: 'Supprimer', danger: true })) { s.rounds.pop(); changed(); }
      } }, icon('undo', 18), 'Supprimer la dernière manche'));

    setChildren(wrap, 
      header(liveGameName(s), {
        back: '#/parties',
        actions: [h('button', { class: 'icon-btn', 'aria-label': 'Tirage au doigt', onclick: () => openPicker() }, icon('hand'))],
      }),
      h('p', { class: 'muted small center-text' }, describeScoring(sc)),
      banner,
      sc.mode !== MODES.COOP && h('div', { class: 'step-bar' },
        h('span', { class: 'muted small' }, 'Pas'),
        segmented(STEPS.map((v, i) => ({ value: i, label: `${isCountdown ? '' : '±'}${v}` })), stepIndex, (i) => { stepIndex = i; draw(); })),
      cards,
      roundsTable,
      h('div', { class: 'sticky-actions' },
        sc.rounds && sc.mode !== MODES.COOP && h('button', { class: 'btn ghost', 'aria-pressed': String(showRounds), onclick: () => { showRounds = !showRounds; draw(); } }, showRounds ? 'Masquer' : 'Manches'),
        sc.rounds && sc.mode !== MODES.COOP && h('button', { class: 'btn primary grow', onclick: () => {
          s.rounds.push({});
          changed();
          vibrate(20);
          toast(`Manche ${s.rounds.length}`, { duration: 1200 });
        } }, icon('plus'), 'Manche suivante'),
        h('button', { class: `btn ${sc.rounds && sc.mode !== MODES.COOP ? '' : 'primary grow'}`, onclick: finish }, icon('check'), 'Terminer')),
    );
  };

  function coopPanel() {
    const r = s.coop?.result;
    const setResult = (v) => { s.coop = { ...s.coop, result: r === v ? null : v }; vibrate(30); changed(); };
    return h('section', { class: 'card stack coop' },
      h('div', { class: 'chips center' }, entrants(s).map((p) => h('span', { class: 'player-chip on', style: { '--c': p.color } }, avatar(p, 28), p.name))),
      h('div', { class: 'row gap' },
        h('button', { class: `coop-btn win ${r === 'win' ? 'on' : ''}`, onclick: () => setResult('win') }, h('span', null, '🎉'), 'Victoire'),
        h('button', { class: `coop-btn loss ${r === 'loss' ? 'on' : ''}`, onclick: () => setResult('loss') }, h('span', null, '💀'), 'Défaite')),
      sc.coopScore && h('div', { class: 'stack center' },
        h('small', { class: 'muted' }, 'Score du groupe'),
        h('div', { class: 'score-controls' },
          h('button', { class: 'big-btn minus', 'aria-label': 'Moins', onclick: () => { s.coop.score = (s.coop.score || 0) - 1; changed(); } }, icon('minus', 32)),
          h('button', { class: 'round-value', onclick: async () => {
            const v = await promptNumber({ title: 'Score du groupe', value: s.coop.score || 0 });
            if (v !== null) { s.coop.score = v; changed(); }
          } }, h('strong', null, String(s.coop.score || 0))),
          h('button', { class: 'big-btn plus', 'aria-label': 'Plus', onclick: () => { s.coop.score = (s.coop.score || 0) + 1; changed(); } }, icon('plus', 32)))));
  }

  draw();
  return { el: wrap, cleanup: () => { document.removeEventListener('visibilitychange', onHide); if (saveTimer) persist(); } };
}

function resultView(s) {
  const sc = normalizeScoring(s.scoring);
  const result = computeResult(sc, s);
  const list = entrants(s);
  const byId = Object.fromEntries(list.map((e) => [e.id, e]));
  const isCountdown = sc.mode === MODES.COUNTDOWN;
  const nameOf = (eid) => byId[eid]?.name || '?';

  let title;
  if (sc.mode === MODES.COOP) title = result.coop?.result === 'win' ? '🎉 Victoire collective !' : '💀 Défaite… la revanche ?';
  else if (result.tie) title = `🤝 Égalité entre ${result.winners.map(nameOf).join(' et ')} !`;
  else title = `🏆 ${nameOf(result.winners[0])} gagne !`;

  const replay = () => {
    const teams = (s.teams || []).map((t) => ({ ...t, id: uuid() }));
    const teamMap = Object.fromEntries((s.teams || []).map((t, i) => [t.id, teams[i].id]));
    const game = store.get('games', s.gameId);
    const scoring = game ? normalizeScoring(game.scoring) : sc;
    const ns = store.save('sessions', {
      gameId: s.gameId, gameName: game?.name || s.gameName, scoring,
      players: s.players.map((p) => ({ ...livePlayer(p), teamId: scoring.teams ? teamMap[p.teamId] ?? null : null })),
      teams: scoring.teams ? teams : [],
      rounds: scoring.rounds ? [{}] : [], finals: {}, coop: { result: null, score: 0 },
      status: 'playing', startedAt: Date.now(), endedAt: null,
    });
    navigate(`/partie/${ns.id}`);
  };
  const reopen = () => {
    store.save('sessions', { ...s, status: 'playing', endedAt: null });
    refresh();
  };
  const remove = async () => {
    if (await confirmDialog('Supprimer cette partie de l’historique ?', { ok: 'Supprimer', danger: true })) {
      store.remove('sessions', s.id);
      toast('Partie supprimée.');
      navigate('/parties', { replace: true });
    }
  };

  const reachedText = (e) => {
    if (sc.mode === MODES.TARGET && e.reachedRound !== Infinity && e.reachedRound != null) return sc.rounds ? `cible atteinte à la manche ${e.reachedRound + 1}` : 'cible atteinte';
    if (isCountdown && e.eliminated) return sc.rounds ? `éliminé·e à la manche ${e.zeroRound + 1}` : 'éliminé·e';
    if (isCountdown && sc.countdownWin === COUNTDOWN_WIN.FIRST_TO_ZERO && e.zeroRound !== Infinity) return sc.rounds ? `à 0 à la manche ${e.zeroRound + 1}` : 'à 0';
    return null;
  };

  return h('div', { class: 'results' },
    header(liveGameName(s), { back: '#/parties' }),
    h('section', { class: `result-hero ${sc.mode === MODES.COOP && result.coop?.result !== 'win' ? 'lost' : ''}` },
      h('div', { class: 'confetti', 'aria-hidden': 'true' }, '🎉✨🎲✨🎉'),
      h('h2', null, title),
      h('p', { class: 'muted' }, `${formatDate(s.endedAt)}${s.startedAt && s.endedAt ? ` · ${formatDuration(s.endedAt - s.startedAt)}` : ''}`)),
    sc.mode === MODES.COOP
      ? h('section', { class: 'card' },
          h('div', { class: 'chips center' }, list.map((p) => h('span', { class: 'player-chip on', style: { '--c': p.color } }, avatar(p, 28), p.name))),
          sc.coopScore && h('p', { class: 'center-text big-number' }, `Score : ${result.coop?.score ?? 0}`))
      : h('ol', { class: 'podium' }, result.ranking.map((e) => {
          const ent = byId[e.id];
          return h('li', { class: `podium-row rank-${e.rank}`, style: { '--c': ent?.color } },
            h('span', { class: 'medal' }, MEDALS[e.rank - 1] || `${e.rank}e`),
            ent && entrantBadge(ent, 44),
            h('span', { class: 'grow' }, h('strong', null, ent?.name || '?'),
              ent?.isTeam && h('small', { class: 'muted' }, ent.members.map((m) => m.name).join(', ')),
              reachedText(e) && h('small', { class: 'muted' }, reachedText(e))),
            h('strong', { class: 'podium-score' }, String(e.value)));
        })),
    sc.rounds && sc.mode !== MODES.COOP && s.rounds.length > 0 && h('section', { class: 'card' },
      h('h3', null, `Détail des ${plural(s.rounds.length, 'manche', 'manches')}`),
      h('div', { class: 'table-wrap' }, h('table', { class: 'rounds' },
        h('thead', null, h('tr', null, h('th', null, '#'), list.map((e) => h('th', { style: { color: e.color } }, e.name)))),
        h('tbody', null, s.rounds.map((r, ri) => h('tr', null, h('td', null, ri + 1), list.map((e) => h('td', null, r[e.id] ?? '·'))))),
        h('tfoot', null, h('tr', null, h('td', null, isCountdown ? 'Reste' : 'Total'),
          list.map((e) => h('td', null, result.ranking.find((x) => x.id === e.id)?.value)))))))
    ,
    h('div', { class: 'stack pad' },
      h('button', { class: 'btn primary big', onclick: replay }, icon('shuffle'), 'Rejouer avec les mêmes joueurs'),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn ghost grow', onclick: reopen }, icon('edit', 18), 'Corriger les scores'),
        h('button', { class: 'btn danger-ghost grow', onclick: remove }, icon('trash', 18), 'Supprimer'))));
}
