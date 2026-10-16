// Lanceur de dés : nombre et type de dés réglables, dés gardés, historique.
import { h, secureRandom, setChildren, vibrate } from '../dom.js';
import { icon } from '../icons.js';
import { header, stepper } from '../components.js';
import { DICE_FACES, MAX_DICE, describeDice, normalizeDice, rollDice, sumDice } from '../../logic/dice.js';

const PREF_KEY = 'ludo.dice';
// Historique conservé pendant l'utilisation de l'app (pas enregistré).
const history = [];

function loadPref() {
  try {
    return normalizeDice(JSON.parse(localStorage.getItem(PREF_KEY))) || { count: 2, faces: 6 };
  } catch {
    return { count: 2, faces: 6 };
  }
}
function savePref(d) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(d));
  } catch {
    /* stockage indisponible */
  }
}

// Positions des points d'un D6 dans une grille 3 × 3 (cases 0 à 8).
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function dieFace(value, faces) {
  if (faces === 6 && PIPS[value]) {
    return h('span', { class: 'pips' }, Array.from({ length: 9 }, (_, i) => h('span', { class: PIPS[value].includes(i) ? 'pip' : '' })));
  }
  return h('span', { class: 'die-num' }, String(value));
}

/** Écran des dés. Paramètres d'URL facultatifs : ?n=5&f=6 (ex. depuis un jeu). */
export function diceView(_, query) {
  const fromQuery = query.n ? normalizeDice({ count: query.n, faces: query.f }) : null;
  const state = { ...(fromQuery || loadPref()), values: [], held: new Set(), rolling: false };
  const backHref = query.retour ? `#${query.retour}` : null;
  let timer = null;

  const tray = h('div', { class: 'dice-tray', 'aria-live': 'polite' });
  const historyEl = h('div');
  const rollBtn = h('button', { class: 'btn primary big grow', onclick: () => roll() }, icon('dice'), 'Lancer');

  const countStep = stepper({
    value: state.count, min: 1, max: MAX_DICE, label: 'Nombre de dés',
    onchange: (v) => { state.count = v; reset(); },
  });
  const facesRow = h('div', { class: 'chips dice-faces', role: 'radiogroup', 'aria-label': 'Type de dé' });
  const drawFaces = () => setChildren(facesRow, DICE_FACES.map((f) =>
    h('button', {
      class: `chip ${state.faces === f ? 'on' : ''}`, role: 'radio', 'aria-checked': String(state.faces === f),
      onclick: () => { state.faces = f; reset(); },
    }, `D${f}`)));

  const reset = () => {
    state.values = [];
    state.held.clear();
    savePref({ count: state.count, faces: state.faces });
    drawFaces();
    draw();
  };

  const draw = () => {
    const dice = state.values.length ? state.values : Array(state.count).fill(null);
    const total = h('div', { class: 'dice-total' }, state.values.length && !state.rolling
      ? [h('small', null, describeDice(state)), h('strong', null, String(sumDice(state.values)))]
      : h('small', null, state.rolling ? '…' : 'Touchez « Lancer » !'));
    setChildren(tray, dice.map((v, i) => {
      const held = state.held.has(i);
      return h('button', {
        class: `die ${state.faces === 6 ? 'd6' : 'dn'} ${held ? 'held' : ''} ${state.rolling && !held ? 'rolling' : ''} ${v === null ? 'blank' : ''}`,
        style: { '--tilt': `${((i * 37) % 13) - 6}deg` },
        'aria-label': v === null ? 'Dé pas encore lancé' : `Dé ${i + 1} : ${v}${held ? ', gardé' : ''}. Toucher pour ${held ? 'relâcher' : 'garder'}`,
        'aria-pressed': String(held),
        disabled: v === null || state.rolling,
        onclick: () => {
          if (held) state.held.delete(i);
          else state.held.add(i);
          vibrate(10);
          draw();
        },
      }, v === null ? h('span', { class: 'die-num' }, '?') : dieFace(v, state.faces), held && h('span', { class: 'die-lock' }, '🔒'));
    }), total);
    rollBtn.disabled = state.rolling || (state.values.length > 0 && state.held.size === state.count);
    setChildren(historyEl, history.length > 0 && h('section', { class: 'card' },
      h('h3', null, 'Derniers lancers'),
      h('ul', { class: 'list' }, history.slice(0, 10).map((r) => h('li', { class: 'row' },
        h('span', { class: 'muted small dice-hist-type' }, describeDice(r)),
        h('span', { class: 'grow dice-hist-values' }, r.values.join(' · ')),
        h('strong', { class: 'score-pill' }, String(sumDice(r.values))))))));
  };

  function roll() {
    if (state.rolling) return;
    const held = state.values.length ? [...state.held] : [];
    const previous = state.values;
    state.rolling = true;
    vibrate([20, 30, 20]);
    let ticks = 0;
    // Animation : les dés défilent quelques instants avant de s'arrêter.
    const tick = () => {
      ticks++;
      state.values = rollDice(state.count, state.faces, { random: Math.random, held, previous });
      if (ticks < 9) {
        draw();
        timer = setTimeout(tick, 45 + ticks * 12);
        return;
      }
      state.values = rollDice(state.count, state.faces, { random: secureRandom, held, previous });
      state.rolling = false;
      history.unshift({ count: state.count, faces: state.faces, values: state.values });
      if (history.length > 30) history.pop();
      vibrate(50);
      draw();
    };
    if (!previous.length) state.values = Array(state.count).fill(1);
    draw();
    tick();
  }

  drawFaces();
  draw();

  const el = h('div', { class: 'dice-view' },
    header('Dés', { back: backHref || '#/' }),
    h('section', { class: 'card stack' },
      h('div', { class: 'field-row' }, h('span', null, 'Nombre de dés'), countStep),
      facesRow),
    tray,
    h('p', { class: 'muted small center-text' }, 'Touchez un dé pour le garder au prochain lancer.'),
    h('div', { class: 'sticky-actions' },
      h('button', { class: 'btn ghost', 'aria-label': 'Relâcher tous les dés', onclick: () => { state.held.clear(); draw(); } }, icon('undo')),
      rollBtn),
    historyEl);
  return { el, cleanup: () => clearTimeout(timer) };
}
