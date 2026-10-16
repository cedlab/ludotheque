// Collection de jeux : liste, filtres, tirage « À quoi joue-t-on ? », fiche.
import { store, navigate } from '../../app.js';
import { h, plural, secureRandom, vibrate, formatDate, setChildren } from '../dom.js';
import { icon } from '../icons.js';
import { confirmDialog, emptyState, gameLogo, header, sheet, toast } from '../components.js';
import { describeScoring } from '../../logic/scoring.js';
import { describeDice, normalizeDice } from '../../logic/dice.js';
import { computeStats, filterHistory } from '../../logic/stats.js';
import { sampleData } from '../../data/sample.js';
import { normalizeName } from '../../data/catalog.js';
import { formatImportSummary } from '../../data/merge.js';
import { sessionRow } from './sessions.js';

// Filtres conservés pendant la session d'utilisation.
const filters = { players: null, duration: null, age: null, q: '' };

export function gameMatches(g, f = filters) {
  if (f.players != null) {
    if (g.minPlayers && f.players < g.minPlayers) return false;
    if (g.maxPlayers && f.players > g.maxPlayers) return false;
  }
  if (f.duration != null && g.duration && g.duration > f.duration) return false;
  if (f.age != null && g.minAge && g.minAge > f.age) return false;
  if (f.q && !normalizeName(g.name).includes(normalizeName(f.q))) return false;
  return true;
}

export function gameMeta(g) {
  const parts = [];
  if (g.minPlayers || g.maxPlayers) {
    parts.push(g.minPlayers === g.maxPlayers ? `${g.minPlayers} j.` : `${g.minPlayers || 1}–${g.maxPlayers || '∞'} j.`);
  }
  if (g.duration) parts.push(`${g.duration} min`);
  if (g.minAge) parts.push(`${g.minAge} ans+`);
  return parts.join(' · ');
}

export const sortedGames = () => store.list('games').sort((a, b) => a.name.localeCompare(b.name, 'fr'));

export function loadSamples() {
  const stats = store.applyRemote(sampleData());
  toast(formatImportSummary(stats));
}

function filterBar(onChange) {
  const chip = (label, value, options, key, fmt) => {
    const sel = h('select', {
      class: `chip-select ${value != null ? 'on' : ''}`, 'aria-label': label,
      onchange: () => {
        filters[key] = sel.value === '' ? null : Number(sel.value);
        onChange();
      },
    },
    h('option', { value: '' }, `${label} : tous`),
    options.map((o) => h('option', { value: String(o), selected: value === o }, fmt(o))));
    return sel;
  };
  return h('div', { class: 'filters' },
    chip('Joueurs', filters.players, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'players', (n) => `👥 ${n} joueur${n > 1 ? 's' : ''}`),
    chip('Durée', filters.duration, [15, 20, 30, 45, 60, 90, 120], 'duration', (n) => `⏱️ ${n} min max`),
    chip('Âge', filters.age, [3, 4, 5, 6, 7, 8, 10, 12, 14], 'age', (n) => `🎂 ${n} ans`),
    (filters.players != null || filters.duration != null || filters.age != null) &&
      h('button', { class: 'chip', onclick: () => { filters.players = filters.duration = filters.age = null; onChange(); } }, 'Effacer'));
}

function randomPick(list) {
  if (list.length === 0) {
    toast('Aucun jeu ne correspond aux filtres.');
    return;
  }
  const chosen = list[Math.floor(secureRandom() * list.length)];
  const stage = h('div', { class: 'draw-stage' });
  const title = h('h2', { class: 'draw-title' }, '…');
  const actions = h('div', { class: 'stack draw-actions hidden' },
    h('button', { class: 'btn primary big', onclick: () => { s.close(); navigate(`/partie/nouvelle?jeu=${chosen.id}`); } },
      icon('play'), 'Lancer une partie'),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn ghost grow', onclick: () => { s.close(); navigate(`/jeu/${chosen.id}`); } }, 'Voir la fiche'),
      list.length > 1 && h('button', { class: 'btn ghost grow', onclick: () => { s.close(); randomPick(list); } }, icon('shuffle'), 'Relancer')));
  const s = sheet(h('div', { class: 'stack center' }, stage, title, actions), { title: 'À quoi joue-t-on ?' });

  // Petite animation de « roulette » qui ralentit avant de s'arrêter.
  let i = 0;
  let delay = 60;
  const steps = Math.min(18, 8 + list.length * 2);
  const spin = () => {
    const g = i >= steps ? chosen : list[Math.floor(secureRandom() * list.length)];
    setChildren(stage, gameLogo(g, 140));
    title.textContent = g.name;
    if (i >= steps) {
      stage.classList.add('pop');
      actions.classList.remove('hidden');
      vibrate(60);
      return;
    }
    i++;
    delay *= 1.12;
    setTimeout(spin, delay);
  };
  spin();
}

export function gamesView() {
  const wrap = h('div');
  const heroSub = h('small');
  const results = h('div');
  const search = h('input', {
    class: 'input search', type: 'search', placeholder: '🔍 Rechercher un jeu…', value: filters.q,
    'aria-label': 'Rechercher un jeu', autocomplete: 'off', enterkeyhint: 'search',
    oninput: () => { filters.q = search.value; drawResults(); },
  });
  const filtered = () => sortedGames().filter((g) => gameMatches(g));

  // Seule la liste est redessinée pendant la frappe : le champ garde le focus.
  const drawResults = () => {
    const all = sortedGames();
    const list = filtered();
    heroSub.textContent = list.length === all.length
      ? `Tirage parmi vos ${plural(all.length, 'jeu', 'jeux')}`
      : `Tirage parmi ${plural(list.length, 'jeu filtré', 'jeux filtrés')}`;
    setChildren(results, list.length === 0
      ? h('p', { class: 'muted center-text pad' }, 'Aucun jeu ne correspond.')
      : h('ul', { class: 'game-grid' },
          list.map((g) => h('li', null,
            h('a', { class: 'game-card', href: `#/jeu/${g.id}` },
              gameLogo(g, 72),
              h('span', { class: 'game-name' }, g.name),
              h('span', { class: 'game-meta' }, gameMeta(g)))))));
  };

  const draw = () => {
    const all = sortedGames();
    setChildren(wrap,
      header('Ludothèque', {
        lead: h('a', { class: 'icon-btn', href: '#/des', 'aria-label': 'Lancer des dés' }, icon('dice')),
        actions: [h('a', { class: 'icon-btn', href: '#/jeu/nouveau', 'aria-label': 'Ajouter un jeu' }, icon('plus'))],
      }),
      all.length === 0
        ? emptyState('🎲', 'Votre ludothèque est vide', 'Ajoutez vos jeux de société, ou découvrez l’app avec quelques exemples.',
            h('a', { class: 'btn primary big', href: '#/jeu/nouveau' }, icon('plus'), 'Ajouter un jeu'),
            h('button', { class: 'btn ghost', onclick: loadSamples }, 'Charger les exemples'))
        : [
            h('button', { class: 'btn hero', onclick: () => randomPick(filtered()) },
              h('span', { class: 'hero-emoji' }, '🎲'),
              h('span', null, h('strong', null, 'À quoi joue-t-on ?'), heroSub)),
            all.length > 8 && h('div', { class: 'pad-x' }, search),
            filterBar(draw),
            results,
          ],
    );
    drawResults();
  };
  draw();
  return wrap;
}

export function gameDetailView({ id }) {
  const g = store.get('games', id);
  if (!g) {
    return h('div', null, header('Jeu introuvable', { back: '#/' }),
      emptyState('🤷', 'Ce jeu n’existe plus', 'Il a peut-être été supprimé.'));
  }
  const sessions = filterHistory(store.list('sessions'), { gameId: id });
  const stats = computeStats({ sessions: store.list('sessions'), games: store.list('games') });
  const best = stats.bestScores.find((b) => b.gameId === id);

  const remove = async () => {
    if (await confirmDialog(`Supprimer « ${g.name} » de la ludothèque ? L’historique des parties est conservé.`, { ok: 'Supprimer', danger: true })) {
      store.remove('games', id);
      toast(`« ${g.name} » supprimé.`);
      navigate('/', { replace: true });
    }
  };

  return h('div', null,
    header(g.name, {
      back: '#/',
      actions: [h('a', { class: 'icon-btn', href: `#/jeu/${id}/modifier`, 'aria-label': 'Modifier' }, icon('edit'))],
    }),
    h('section', { class: 'card game-hero' },
      gameLogo(g, 112),
      h('div', { class: 'facts' },
        fact('users', g.minPlayers === g.maxPlayers ? `${g.minPlayers} joueurs` : `${g.minPlayers || 1} à ${g.maxPlayers || '∞'} joueurs`),
        g.duration ? fact('clock', `${g.duration} min`) : null,
        g.minAge ? fact('cake', `Dès ${g.minAge} ans`) : null,
        fact('trophy', describeScoring(g.scoring)),
        normalizeDice(g.dice) && fact('dice', `Dés : ${describeDice(normalizeDice(g.dice))}`))),
    h('div', { class: 'stack pad-x' },
      h('a', { class: 'btn primary big', href: `#/partie/nouvelle?jeu=${id}` }, icon('play'), 'Lancer une partie'),
      normalizeDice(g.dice) && h('a', { class: 'btn big', href: diceHref(g, `/jeu/${id}`) }, icon('dice'), `Lancer les dés (${describeDice(normalizeDice(g.dice))})`)),
    g.notes && h('section', { class: 'card' }, h('h3', null, 'Notes'), h('p', { class: 'notes' }, g.notes)),
    h('section', { class: 'card' },
      h('h3', null, 'Historique'),
      sessions.length === 0
        ? h('p', { class: 'muted' }, 'Aucune partie jouée pour l’instant.')
        : [
            h('p', { class: 'muted' }, `${plural(sessions.length, 'partie jouée', 'parties jouées')}`,
              best ? ` · Meilleur score : ${best.value} (${best.holders.join(', ')})` : ''),
            h('ul', { class: 'list' }, sessions.slice(0, 20).map((s) => sessionRow(s, { showGame: false }))),
          ]),
    h('div', { class: 'pad' }, h('button', { class: 'btn danger-ghost', onclick: remove }, icon('trash'), 'Supprimer ce jeu')),
    h('p', { class: 'muted small center-text' }, `Ajouté le ${formatDate(g.createdAt)}`));
}

function fact(ic, text) {
  return h('div', { class: 'fact' }, icon(ic, 20), h('span', null, text));
}

/** Lien vers l'écran des dés, avec la configuration du jeu s'il en a une. */
export function diceHref(game, retour) {
  const d = normalizeDice(game?.dice);
  const q = new URLSearchParams();
  if (d) {
    q.set('n', d.count);
    q.set('f', d.faces);
  }
  if (retour) q.set('retour', retour);
  const qs = q.toString();
  return `#/des${qs ? `?${qs}` : ''}`;
}
