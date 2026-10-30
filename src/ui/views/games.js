// Collection de jeux : liste, filtres, tirage « À quoi joue-t-on ? », fiche.
import { store, navigate, refresh } from '../../app.js';
import { h, plural, secureRandom, vibrate, formatDate, setChildren } from '../dom.js';
import { icon } from '../icons.js';
import { avatar, confirmDialog, emptyState, gameLogo, header, segmented, sheet, toast } from '../components.js';
import { describeScoring } from '../../logic/scoring.js';
import { describeDice, normalizeDice } from '../../logic/dice.js';
import { GAME_STYLES, gameMatchesStyles, gameStyles, styleById } from '../../logic/styles.js';
import { computeStats, filterHistory } from '../../logic/stats.js';
import { GAME_LISTS, gameList, listById } from '../../logic/collection.js';
import { ageLabel, ageOptions, gameMatchesAges } from '../../logic/ages.js';
import { fansOf, gameMatchesFans, toggleFan } from '../../logic/favorites.js';
import { MAX_STARS, RATING_LABELS, normalizeReview, stars } from '../../logic/review.js';
import { samplesFor } from '../../data/sample.js';
import { normalizeName } from '../../data/catalog.js';
import { formatImportSummary } from '../../data/merge.js';
import { sessionRow } from './sessions.js';
import { sortedPlayers } from './players.js';

// Filtres conservés pendant la session d'utilisation.
const filters = { list: 'owned', fans: [], fansMode: 'any', players: null, duration: null, ages: [], styles: [], styleMode: 'any', q: '' };

export function gameMatches(g, f = filters) {
  if (!gameMatchesFans(g, f.fans, f.fansMode)) return false;
  if (f.players != null) {
    if (g.minPlayers && f.players < g.minPlayers) return false;
    if (g.maxPlayers && f.players > g.maxPlayers) return false;
  }
  if (f.duration != null && g.duration && g.duration > f.duration) return false;
  if (!gameMatchesAges(g, f.ages)) return false;
  if (f.q && !normalizeName(g.name).includes(normalizeName(f.q))) return false;
  if (!gameMatchesStyles(g, f.styles, f.styleMode)) return false;
  return true;
}

export function gameMeta(g) {
  const parts = [];
  if (g.minPlayers || g.maxPlayers) {
    parts.push(g.minPlayers === g.maxPlayers ? `${g.minPlayers} j.` : `${g.minPlayers || 1}–${g.maxPlayers || '∞'} j.`);
  }
  if (g.duration) parts.push(`${g.duration} min`);
  if (g.minAge) parts.push(`${g.minAge} ans+`);
  const review = normalizeReview(g.review);
  if (review?.rating) parts.push(`${review.rating}★`);
  return parts.join(' · ');
}

const LIST_ORDER = Object.fromEntries(GAME_LISTS.map((l, i) => [l.id, i]));

/** Jeux par ordre alphabétique, ceux de la maison d'abord. */
export const sortedGames = () => store.list('games').sort((a, b) =>
  LIST_ORDER[gameList(a)] - LIST_ORDER[gameList(b)] || a.name.localeCompare(b.name, 'fr'));

/** Change un jeu de liste (testé → à acquérir → à la maison). */
export function moveGame(id, status) {
  const g = store.get('games', id);
  if (!g || gameList(g) === status) return;
  store.save('games', { ...g, status });
  toast(status === 'owned' ? `« ${g.name} » rejoint votre ludothèque 🎉` : `« ${g.name} » ${listById(status).added}.`);
}

const LIST_EMPTY = {
  totest: ['🔍', 'Rien à tester pour l’instant', 'Notez ici les jeux repérés qui vous tentent, pour les essayer à l’association, chez des amis ou en boutique.'],
  tested: ['🧪', 'Aucun jeu testé', 'Notez ici les jeux essayés à l’association ou chez des amis, pour vous en souvenir.'],
  wishlist: ['🛒', 'Rien à acquérir pour l’instant', 'Ajoutez les jeux qui vous font envie : pratique pour une idée de cadeau.'],
};

/** Joueurs (encore existants) qui aiment ce jeu, dans l'ordre alphabétique. */
export const gameFans = (g) => {
  const ids = new Set(fansOf(g));
  return sortedPlayers().filter((p) => ids.has(p.id));
};

/** Pastilles des fans : les trois premiers, puis « +N ». */
export function fanAvatars(fans, size = 22) {
  if (fans.length === 0) return null;
  return h('span', { class: 'fans', title: fans.map((p) => p.name).join(', ') },
    fans.slice(0, 3).map((p) => avatar(p, size)),
    fans.length > 3 && h('span', { class: 'fans-more' }, `+${fans.length - 3}`));
}

/** Fenêtre « Qui aime ce jeu ? » : on touche un joueur pour l'ajouter ou le retirer. */
export function openFansSheet(gameId, onChange) {
  const box = h('div', { class: 'stack' });
  const players = sortedPlayers();
  const draw = () => {
    const g = store.get('games', gameId);
    if (!g) return;
    const fans = new Set(fansOf(g));
    setChildren(box, players.length === 0
      ? [h('p', { class: 'muted' }, 'Ajoutez d’abord les joueurs de la famille, puis indiquez leurs jeux préférés.'),
          h('a', { class: 'btn primary', href: '#/joueurs', onclick: () => s.close() }, 'Ajouter des joueurs')]
      : [
          h('div', { class: 'fan-list' }, players.map((p) => {
            const on = fans.has(p.id);
            return h('button', {
              type: 'button', class: `fan-row ${on ? 'on' : ''}`, 'aria-pressed': String(on),
              onclick: () => {
                store.save('games', { ...g, favoriteOf: toggleFan(g, p.id) });
                vibrate(15);
                draw();
                onChange?.();
              },
            }, avatar(p, 36), h('span', { class: 'grow' }, p.name), icon('heart', 24));
          })),
          h('button', { class: 'btn primary', onclick: () => s.close() }, 'Terminé'),
        ]);
  };
  const s = sheet(box, { title: `Qui aime « ${store.get('games', gameId)?.name} » ?` });
  draw();
}

/** Cœur : plein si au moins un joueur aime le jeu ; ouvre « Qui aime ce jeu ? ». */
function favoriteButton(g, { onChange, className = '' } = {}) {
  const on = gameFans(g).length > 0;
  return h('button', {
    type: 'button', class: `fav-btn ${className} ${on ? 'on' : ''}`, 'aria-haspopup': 'dialog',
    'aria-label': `Qui aime « ${g.name} » ?`,
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      openFansSheet(g.id, onChange);
    },
  }, icon('heart', 22));
}

export function loadSamples() {
  const stats = store.applyRemote(samplesFor(store.list('games'), normalizeName));
  toast(formatImportSummary(stats));
}

/** Nombre de jeux affichés avec les filtres actuels (dans l'onglet ouvert). */
const visibleCount = () => sortedGames().filter((g) => gameList(g) === filters.list && gameMatches(g)).length;

/** Feuille de choix des âges (plusieurs possibles). Le filtre s'applique en direct. */
function openAgePicker(onChange) {
  const box = h('div', { class: 'stack' });
  const options = ageOptions(sortedGames().filter((g) => gameList(g) === filters.list));
  const draw = () => {
    setChildren(box,
      h('p', { class: 'muted small' }, 'Cochez un ou plusieurs âges : les jeux conseillés à partir de ces âges sont affichés.'),
      h('div', { class: 'chips' }, options.map((age) => {
        const on = filters.ages.includes(age);
        return h('button', {
          type: 'button', class: `chip style-chip ${on ? 'on' : ''}`, 'aria-pressed': String(on),
          onclick: () => {
            filters.ages = on ? filters.ages.filter((x) => x !== age) : [...filters.ages, age].sort((a, b) => a - b);
            onChange();
            draw();
          },
        }, `🎂 ${ageLabel(age)}`);
      })),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn ghost grow', disabled: filters.ages.length === 0, onclick: () => { filters.ages = []; onChange(); draw(); } }, 'Tout décocher'),
        h('button', { class: 'btn primary grow', onclick: () => s.close() }, `Voir ${plural(visibleCount(), 'jeu', 'jeux')}`)));
  };
  const s = sheet(box, { title: 'Âge' });
  draw();
}

/** Feuille de choix des styles (plusieurs possibles). Le filtre s'applique en direct. */
function openStylePicker(onChange) {
  const box = h('div', { class: 'stack' });
  const draw = () => {
    const count = visibleCount();
    setChildren(box,
      h('div', { class: 'chips' }, GAME_STYLES.map((st) => {
        const on = filters.styles.includes(st.id);
        return h('button', {
          type: 'button', class: `chip style-chip ${on ? 'on' : ''}`, 'aria-pressed': String(on),
          onclick: () => {
            filters.styles = on ? filters.styles.filter((x) => x !== st.id) : [...filters.styles, st.id];
            onChange();
            draw();
          },
        }, `${st.emoji} ${st.label}`);
      })),
      filters.styles.length > 1 && h('div', { class: 'stack tight' },
        h('small', { class: 'muted' }, 'Les jeux doivent avoir :'),
        segmented([
          { value: 'any', label: 'Au moins un de ces styles' },
          { value: 'all', label: 'Tous ces styles' },
        ], filters.styleMode, (m) => { filters.styleMode = m; onChange(); draw(); }, { className: 'wrap' })),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn ghost grow', disabled: filters.styles.length === 0, onclick: () => { filters.styles = []; onChange(); draw(); } }, 'Tout décocher'),
        h('button', { class: 'btn primary grow', onclick: () => s.close() }, `Voir ${plural(count, 'jeu', 'jeux')}`)));
  };
  const s = sheet(box, { title: 'Styles de jeu' });
  draw();
}

function fansChipLabel() {
  // Un joueur supprimé entre-temps ne compte plus.
  const names = sortedPlayers().filter((p) => filters.fans.includes(p.id)).map((p) => p.name);
  if (names.length === 0) return 'Favoris';
  if (names.length <= 2) return names.join(filters.fansMode === 'all' ? ' & ' : ', ');
  return `${names.length} joueurs`;
}

/** Feuille « Favoris de… » : un ou plusieurs joueurs, au moins un ou tous. */
function openFansFilter(onChange) {
  const box = h('div', { class: 'stack' });
  const players = sortedPlayers();
  const draw = () => {
    setChildren(box, players.length === 0
      ? h('p', { class: 'muted' }, 'Aucun joueur pour l’instant : ajoutez-les dans l’onglet Joueurs, puis touchez le cœur d’un jeu.')
      : [
          h('div', { class: 'chips' }, players.map((p) => {
            const on = filters.fans.includes(p.id);
            return h('button', {
              type: 'button', class: `chip fan-chip ${on ? 'on' : ''}`, 'aria-pressed': String(on),
              onclick: () => {
                filters.fans = on ? filters.fans.filter((x) => x !== p.id) : [...filters.fans, p.id];
                onChange();
                draw();
              },
            }, avatar(p, 26), p.name);
          })),
          filters.fans.length > 1 && h('div', { class: 'stack tight' },
            h('small', { class: 'muted' }, 'Afficher les jeux aimés par :'),
            segmented([
              { value: 'any', label: 'Au moins un d’eux' },
              { value: 'all', label: 'Tous (favoris communs)' },
            ], filters.fansMode, (m) => { filters.fansMode = m; onChange(); draw(); }, { className: 'wrap' })),
          h('div', { class: 'row gap' },
            h('button', { class: 'btn ghost grow', disabled: filters.fans.length === 0, onclick: () => { filters.fans = []; onChange(); draw(); } }, 'Tout décocher'),
            h('button', { class: 'btn primary grow', onclick: () => s.close() }, `Voir ${plural(visibleCount(), 'jeu', 'jeux')}`)),
        ]);
  };
  const s = sheet(box, { title: 'Favoris de…' });
  draw();
}

function ageChipLabel() {
  const a = filters.ages;
  if (a.length === 0) return 'Âge : tous';
  if (a.length === 1) return `🎂 ${ageLabel(a[0])}`;
  if (a.length <= 3 && !a.includes(0)) return `🎂 Dès ${a.join(', ')} ans`;
  return `🎂 ${a.length} âges`;
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
  const n = filters.styles.length;
  const styleLabel = n === 0 ? 'Style : tous'
    : n === 1 ? (() => { const st = styleById(filters.styles[0]); return `${st.emoji} ${st.label}`; })()
      : `🎭 ${n} styles`;
  const styleSelect = h('button', {
    class: `chip-select ${n ? 'on' : ''}`, 'aria-label': 'Choisir les styles', 'aria-haspopup': 'dialog',
    onclick: () => openStylePicker(onChange),
  }, `${styleLabel} ▾`);
  return h('div', { class: 'filters' },
    h('button', {
      type: 'button', class: `chip-select fav-chip ${filters.fans.length ? 'on' : ''}`, 'aria-haspopup': 'dialog',
      'aria-label': 'Favoris de…', onclick: () => openFansFilter(onChange),
    }, icon('heart', 16), `${fansChipLabel()} ▾`),
    chip('Joueurs', filters.players, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'players', (n) => `👥 ${n} joueur${n > 1 ? 's' : ''}`),
    chip('Durée', filters.duration, [15, 20, 30, 45, 60, 90, 120], 'duration', (n) => `⏱️ ${n} min max`),
    h('button', {
      class: `chip-select ${filters.ages.length ? 'on' : ''}`, 'aria-label': 'Choisir les âges', 'aria-haspopup': 'dialog',
      onclick: () => openAgePicker(onChange),
    }, `${ageChipLabel()} ▾`),
    styleSelect,
    (filters.fans.length > 0 || filters.players != null || filters.duration != null || filters.ages.length > 0 || filters.styles.length > 0) &&
      h('button', { class: 'chip', onclick: () => {
        filters.players = filters.duration = null;
        filters.ages = [];
        filters.fans = [];
        filters.styles = [];
        onChange();
      } }, 'Effacer'));
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
  const inList = () => sortedGames().filter((g) => gameList(g) === filters.list);
  const filtered = () => inList().filter((g) => gameMatches(g));

  // Seule la liste est redessinée pendant la frappe : le champ garde le focus.
  const drawResults = () => {
    const all = inList();
    const list = filtered();
    heroSub.textContent = list.length === all.length
      ? `Tirage parmi vos ${plural(all.length, 'jeu', 'jeux')}`
      : `Tirage parmi ${plural(list.length, 'jeu filtré', 'jeux filtrés')}`;
    setChildren(results, list.length === 0
      ? h('p', { class: 'muted center-text pad' }, filters.fans.length && !all.some((g) => gameFans(g).length)
        ? 'Aucun favori pour l’instant : touchez le cœur d’un jeu pour dire qui l’aime.'
        : 'Aucun jeu ne correspond.')
      : h('ul', { class: 'game-grid' },
          list.map((g) => h('li', { class: 'game-cell' },
            h('a', { class: 'game-card', href: `#/jeu/${g.id}` },
              gameLogo(g, 72),
              h('span', { class: 'game-name' }, g.name),
              h('span', { class: 'game-meta' }, gameMeta(g)),
              fanAvatars(gameFans(g))),
            favoriteButton(g, { onChange: drawResults })))));
  };

  const draw = () => {
    const everything = sortedGames();
    const all = inList();
    const owned = filters.list === 'owned';
    const addHref = owned ? '#/jeu/nouveau' : `#/jeu/nouveau?liste=${filters.list}`;
    const counts = Object.fromEntries(GAME_LISTS.map((l) => [l.id, everything.filter((g) => gameList(g) === l.id).length]));
    // Les onglets n'apparaissent qu'une fois la ludothèque commencée.
    const tabs = everything.length > 0 && h('div', { class: 'pad-x list-tabs' },
      segmented(GAME_LISTS.map((l) => ({
        value: l.id,
        label: [h('span', null, l.tab), h('small', { class: 'tab-count' }, String(counts[l.id]))],
      })), filters.list, (v) => { filters.list = v; draw(); }));
    setChildren(wrap,
      header(owned ? 'Ludothèque' : listById(filters.list).label, {
        lead: h('a', { class: 'icon-btn', href: '#/des', 'aria-label': 'Lancer des dés' }, icon('dice')),
        actions: [h('a', { class: 'icon-btn', href: addHref, 'aria-label': 'Ajouter un jeu' }, icon('plus'))],
      }),
      tabs,
      !owned && all.length === 0
        ? emptyState(...LIST_EMPTY[filters.list],
            h('a', { class: 'btn primary big', href: addHref }, icon('plus'), 'Ajouter un jeu'),
            h('p', { class: 'muted small' }, 'Astuce : depuis la fiche d’un jeu testé, un bouton le passe en « À acquérir », puis dans la ludothèque une fois acheté.'))
      : all.length === 0
        ? emptyState('🎲', 'Votre ludothèque est vide', 'Ajoutez vos jeux de société, ou découvrez l’app avec quelques exemples.',
            h('a', { class: 'btn primary big', href: '#/jeu/nouveau' }, icon('plus'), 'Ajouter un jeu'),
            h('button', { class: 'btn ghost', onclick: loadSamples }, 'Charger les exemples'))
        : [
            owned && h('button', { class: 'btn hero', onclick: () => randomPick(filtered()) },
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
      actions: [
        favoriteButton(g, { className: 'icon-btn', onChange: refresh }),
        h('a', { class: 'icon-btn', href: `#/jeu/${id}/modifier`, 'aria-label': 'Modifier' }, icon('edit')),
      ],
    }),
    h('section', { class: 'card game-hero' },
      gameLogo(g, 112),
      h('div', { class: 'facts' },
        fact('users', g.minPlayers === g.maxPlayers ? plural(g.minPlayers, 'joueur', 'joueurs') : `${g.minPlayers || 1} à ${g.maxPlayers || '∞'} joueurs`),
        g.duration ? fact('clock', `${g.duration} min`) : null,
        g.minAge ? fact('cake', `Dès ${g.minAge} ans`) : null,
        fact('trophy', describeScoring(g.scoring)),
        normalizeDice(g.dice) && fact('dice', `Dés : ${describeDice(normalizeDice(g.dice))}`),
        gameStyles(g).length > 0 && h('div', { class: 'style-tags' }, gameStyles(g).map((id) => {
          const st = styleById(id);
          return h('span', { class: 'style-tag' }, `${st.emoji} ${st.label}`);
        })))),
    fansCard(g),
    gameList(g) !== 'owned' && listCard(g),
    reviewCard(g),
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

/** « Favori de » sur la fiche du jeu ; toucher la ligne ouvre « Qui aime ce jeu ? ». */
function fansCard(g) {
  const fans = gameFans(g);
  return h('button', { type: 'button', class: 'card fans-card', onclick: () => openFansSheet(g.id, refresh) },
    h('span', { class: `fans-heart ${fans.length ? 'on' : ''}` }, icon('heart', 22)),
    h('span', { class: 'grow' }, fans.length
      ? [h('small', { class: 'muted' }, 'Favori de'), h('strong', null, fans.map((p) => p.name).join(', '))]
      : h('span', { class: 'muted' }, 'Personne ne l’a encore en favori')),
    fans.length ? fanAvatars(fans, 28) : h('span', { class: 'link' }, 'Ajouter'));
}

/**
 * Fenêtre « Notre avis » : des étoiles et un commentaire. `then` reçoit l'avis
 * (ou null) ; avec `skip`, un second bouton permet de continuer sans avis.
 */
export function openReviewSheet(gameId, { title, saveLabel = 'Enregistrer', skip, then } = {}) {
  const g = store.get('games', gameId);
  if (!g) return;
  const current = normalizeReview(g.review) || { rating: 0, comment: '' };
  let rating = current.rating;
  const starsRow = h('div', { class: 'stars-input', role: 'radiogroup', 'aria-label': 'Note' });
  const label = h('p', { class: 'muted small center-text' });
  const drawStars = () => {
    setChildren(starsRow, Array.from({ length: MAX_STARS }, (_, i) => h('button', {
      type: 'button', class: `star ${i < rating ? 'on' : ''}`, role: 'radio', 'aria-checked': String(i + 1 === rating),
      'aria-label': `${i + 1} sur ${MAX_STARS} : ${RATING_LABELS[i + 1]}`,
      onclick: () => { rating = rating === i + 1 ? 0 : i + 1; vibrate(10); drawStars(); },
    }, '★')));
    label.textContent = rating ? RATING_LABELS[rating] : 'Touchez les étoiles pour noter';
  };
  drawStars();
  const comment = h('textarea', { class: 'input', rows: '4', maxlength: '1000',
    placeholder: 'Où, avec qui, ce qui vous a plu ou non, l’âge conseillé…' }, current.comment);
  const done = (review) => { s.close(); then?.(review); };
  const s = sheet(h('div', { class: 'stack' },
    starsRow, label, comment,
    h('button', { class: 'btn primary', onclick: () => done(normalizeReview({ rating, comment: comment.value, at: Date.now() })) }, saveLabel),
    skip && h('button', { class: 'btn ghost', onclick: () => done(undefined) }, skip)),
  { title: title || `Notre avis sur « ${g.name} »` });
}

/** Enregistre l'avis (null efface ; undefined ne change rien) et, si demandé, change le jeu de liste. */
function saveReview(id, review, status) {
  const g = store.get('games', id);
  if (!g) return;
  const fields = { ...g };
  if (review !== undefined) fields.review = review;
  if (status) fields.status = status;
  store.save('games', fields);
}

/** « Notre avis » sur la fiche : visible dès qu'il y a un avis, ou pour un jeu à tester / testé. */
function reviewCard(g) {
  const review = normalizeReview(g.review);
  const list = gameList(g);
  if (!review && list !== 'totest' && list !== 'tested') return null;
  const edit = () => openReviewSheet(g.id, { then: (r) => { if (r !== undefined) { saveReview(g.id, r); refresh(); } } });
  return h('section', { class: 'card stack' },
    h('div', { class: 'row gap' }, h('h3', { class: 'grow' }, '💬 Notre avis'),
      h('button', { class: 'btn small ghost', onclick: edit }, review ? 'Modifier' : 'Donner notre avis')),
    review
      ? [review.rating > 0 && h('p', { class: 'review-stars' }, h('span', { 'aria-hidden': 'true' }, stars(review.rating)), h('small', null, RATING_LABELS[review.rating])),
          review.comment && h('p', { class: 'notes' }, review.comment),
          review.at > 0 && h('p', { class: 'muted small' }, `Le ${formatDate(review.at)}`)]
      : h('p', { class: 'muted' }, list === 'totest'
        ? 'Après l’avoir essayé, touchez « Je l’ai testé » : vous pourrez le noter et écrire ce que vous en avez pensé.'
        : 'Notez-le et écrivez ce que vous en avez pensé, pour vous en souvenir.'));
}

/** Fiche d'un jeu testé ou à acquérir : où il en est, et de quoi le faire avancer. */
const LIST_BADGE = {
  totest: 'À tester',
  tested: 'Testé, pas encore à la maison',
  wishlist: 'Sur la liste « À acquérir »',
};

function listCard(g) {
  const list = gameList(g);
  const go = (status) => { moveGame(g.id, status); refresh(); };
  return h('section', { class: 'card stack list-card' },
    h('p', { class: 'list-badge' }, `${listById(list).emoji} ${LIST_BADGE[list]}`),
    list === 'totest' && h('button', { class: 'btn primary', onclick: () => openReviewSheet(g.id, {
      title: `Vous avez testé « ${g.name} » : alors ?`,
      saveLabel: 'Enregistrer et ranger dans « Testés »',
      skip: 'Ranger dans « Testés » sans avis',
      then: (review) => { saveReview(g.id, review, 'tested'); toast(`« ${g.name} » ${listById('tested').added}.`); refresh(); },
    }) }, '🧪 Je l’ai testé'),
    list !== 'wishlist' && h('button', { class: 'btn', onclick: () => go('wishlist') }, '🛒 Ajouter à « À acquérir »'),
    h('button', { class: `btn ${list === 'totest' ? '' : 'primary'}`, onclick: () => go('owned') }, '🏠 Je l’ai, il est à la maison'),
    list === 'totest' && h('p', { class: 'muted small' }, 'Il ne vous plaît pas ? Supprimez-le avec le bouton en bas de la fiche.'));
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
