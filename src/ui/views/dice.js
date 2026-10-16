// Lanceur de dés : nombre et type de dés réglables, dés gardés, historique.
// L'animation est une petite simulation physique (logic/dice-physics.js) :
// les dés sont lancés, rebondissent, se cognent et ralentissent avant de se poser.
import { h, secureRandom, setChildren, vibrate } from '../dom.js';
import { icon } from '../icons.js';
import { header, stepper } from '../components.js';
import { DICE_FACES, MAX_DICE, describeDice, normalizeDice, rollDice, sumDice } from '../../logic/dice.js';
import { DiceTable } from '../../logic/dice-physics.js';
import { knock, setSoundEnabled, soundEnabled, unlockAudio } from '../sound.js';

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
  if (value === null) return h('span', { class: 'die-num' }, '?');
  if (faces === 6 && PIPS[value]) {
    return h('span', { class: 'pips' }, Array.from({ length: 9 }, (_, i) => h('span', { class: PIPS[value].includes(i) ? 'pip' : '' })));
  }
  return h('span', { class: 'die-num' }, String(value));
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Écran des dés. Paramètres d'URL facultatifs : ?n=5&f=6 (ex. depuis un jeu). */
export function diceView(_, query) {
  const fromQuery = query.n ? normalizeDice({ count: query.n, faces: query.f }) : null;
  const state = { ...(fromQuery || loadPref()), held: new Set() };
  const backHref = query.retour ? `#${query.retour}` : '#/';
  const table = new DiceTable({ faces: state.faces });
  let els = [];
  let raf = 0;
  let lastFrame = 0;
  let lastBuzz = 0;

  const tray = h('div', { class: 'dice-tray', 'aria-live': 'polite' });
  const totalEl = h('div', { class: 'dice-total' });
  const historyEl = h('div');
  const rollBtn = h('button', { class: 'btn primary big grow', onclick: () => roll() }, icon('dice'), 'Lancer');
  const soundBtn = h('button', { class: 'icon-btn', onclick: () => { setSoundEnabled(!soundEnabled()); drawSound(); } });
  const drawSound = () => {
    soundBtn.textContent = soundEnabled() ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-label', soundEnabled() ? 'Couper le son' : 'Activer le son');
  };
  drawSound();

  const hasValues = () => table.dice.length > 0 && table.dice.every((d) => d.value !== null);

  // --- Tapis ------------------------------------------------------------------

  const dieSize = () => (state.count > 8 || tray.clientWidth < 330 ? 54 : 64);

  const fitTray = () => {
    const top = tray.getBoundingClientRect().top + window.scrollY;
    // Le tapis occupe la place visible entre les réglages et la barre « Lancer ».
    const height = Math.round(Math.min(460, Math.max(230, window.innerHeight - top - 190)));
    tray.style.height = `${height}px`;
    table.resize(tray.clientWidth, height, dieSize());
  };

  const buildDice = () => {
    els = table.dice.map((d, i) => {
      const face = h('span', { class: 'die-face' });
      const el = h('button', {
        class: `die ${state.faces === 6 ? 'd6' : 'dn'}`,
        style: { width: `${table.size}px`, height: `${table.size}px` },
        onclick: () => {
          if (table.rolling || !hasValues()) return;
          if (state.held.has(i)) state.held.delete(i);
          else state.held.add(i);
          vibrate(10);
          paint(true);
          drawTotal();
        },
      }, face, h('span', { class: 'die-lock' }, '🔒'));
      el._face = face;
      el._shown = undefined;
      return el;
    });
    setChildren(tray, els);
  };

  /** Met à jour la position et la face de chaque dé (appelé à chaque image). */
  const paint = (force = false) => {
    const half = table.size / 2;
    table.dice.forEach((d, i) => {
      const el = els[i];
      if (!el) return;
      const lift = d.z;
      el.style.transform = `translate3d(${d.x - half}px, ${d.y - half}px, 0) rotate(${d.angle}deg) scale(${1 + 0.35 * lift})`;
      el.style.setProperty('--lift', lift.toFixed(2));
      el.style.zIndex = d.moving ? '2' : '1';
      // À l'arrêt, le dé pivote en douceur vers sa position de repos (transition CSS).
      el.classList.toggle('resting', !d.moving);
      if (force || el._shown !== d.value) {
        el._shown = d.value;
        setChildren(el._face, dieFace(d.value, state.faces));
      }
      const held = state.held.has(i);
      el.classList.toggle('held', held);
      el.disabled = d.value === null;
      el.setAttribute('aria-label', d.value === null
        ? 'Dé pas encore lancé'
        : `Dé ${i + 1} : ${d.value}${held ? ', gardé' : ''}. Toucher pour ${held ? 'relâcher' : 'garder'}`);
    });
  };

  const drawTotal = () => {
    const values = table.dice.map((d) => d.value);
    setChildren(totalEl, table.rolling
      ? h('strong', { class: 'rolling-dots' }, '…')
      : hasValues()
        ? [h('small', null, 'Total'), h('strong', { class: 'pop-in' }, String(sumDice(values)))]
        : h('small', null, describeDice(state)));
    rollBtn.disabled = table.rolling || (hasValues() && state.held.size === state.count);
  };

  const drawHistory = () => setChildren(historyEl, history.length > 0 && h('section', { class: 'card' },
    h('h3', null, 'Derniers lancers'),
    h('ul', { class: 'list' }, history.slice(0, 10).map((r) => h('li', { class: 'row' },
      h('span', { class: 'muted small dice-hist-type' }, describeDice(r)),
      h('span', { class: 'grow dice-hist-values' }, r.values.join(' · ')),
      h('strong', { class: 'score-pill' }, String(sumDice(r.values))))))));

  const reset = () => {
    cancelAnimationFrame(raf);
    state.held.clear();
    savePref({ count: state.count, faces: state.faces });
    table.faces = state.faces;
    table.resize(tray.clientWidth || 320, table.height, dieSize());
    table.layout(state.count, state.faces);
    drawFaces();
    buildDice();
    paint(true);
    drawTotal();
  };

  // --- Lancer -------------------------------------------------------------------

  const frame = (t) => {
    const dt = Math.min(0.05, (t - lastFrame) / 1000 || 0.016);
    lastFrame = t;
    const { impacts, done } = table.step(dt);
    if (impacts.length) {
      const strongest = Math.max(...impacts);
      knock(strongest);
      if (strongest > 250 && t - lastBuzz > 70) {
        lastBuzz = t;
        vibrate(Math.min(18, Math.round(strongest / 120)));
      }
    }
    paint();
    if (done) return finish();
    raf = requestAnimationFrame(frame);
  };

  const finish = () => {
    const values = table.dice.map((d) => d.value);
    history.unshift({ count: state.count, faces: state.faces, values });
    if (history.length > 30) history.pop();
    paint(true);
    drawTotal();
    drawHistory();
  };

  function roll() {
    if (table.rolling) return;
    unlockAudio();
    const held = hasValues() ? state.held : new Set();
    if (!held.size) state.held.clear();
    const previous = table.dice.map((d) => d.value);
    // Tirage équitable des valeurs finales, AVANT l'animation.
    const finals = rollDice(state.count, state.faces, { random: secureRandom, held: [...held], previous });
    table.throw(finals, held);
    vibrate(15);
    drawTotal();
    if (reducedMotion()) {
      table.finish();
      return finish();
    }
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // --- Réglages -------------------------------------------------------------------

  const countStep = stepper({
    value: state.count, min: 1, max: MAX_DICE, label: 'Nombre de dés',
    onchange: (v) => { state.count = v; reset(); },
  });
  const facesRow = h('div', { class: 'chips dice-faces', role: 'radiogroup', 'aria-label': 'Type de dé' });
  const drawFaces = () => setChildren(facesRow, DICE_FACES.map((f) =>
    h('button', {
      class: `chip ${state.faces === f ? 'on' : ''}`, role: 'radio', 'aria-checked': String(state.faces === f),
      onclick: () => { if (!table.rolling) { state.faces = f; reset(); } },
    }, `D${f}`)));

  const onResize = () => {
    fitTray();
    if (els.length && els[0].style.width !== `${table.size}px`) buildDice();
    paint(true);
  };

  const el = h('div', { class: 'dice-view' },
    header('Dés', { back: backHref, actions: [soundBtn] }),
    h('section', { class: 'card stack dice-settings' },
      h('div', { class: 'field-row' }, h('span', null, 'Nombre de dés'), countStep),
      facesRow),
    tray,
    h('p', { class: 'muted small center-text' }, 'Touchez un dé pour le garder au prochain lancer.'),
    h('div', { class: 'sticky-actions' },
      h('button', { class: 'btn ghost', 'aria-label': 'Relâcher tous les dés', onclick: () => { state.held.clear(); paint(true); drawTotal(); } }, icon('undo')),
      totalEl,
      rollBtn),
    historyEl);

  // Mise en place une fois l'écran affiché (il faut connaître la taille du tapis).
  table.layout(state.count, state.faces);
  drawFaces();
  drawTotal();
  drawHistory();
  requestAnimationFrame(() => {
    fitTray();
    table.layout(state.count, state.faces);
    buildDice();
    paint(true);
  });
  window.addEventListener('resize', onResize);

  return {
    el,
    cleanup: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    },
  };
}
