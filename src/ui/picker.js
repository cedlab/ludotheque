// Écran plein écran du tirage au doigt (multitouch).
// Utilise les Touch Events (les plus fiables sur iOS Safari et Android Chrome)
// et, à défaut (ordinateur), les Pointer Events.
import { h, secureRandom, vibrate, setChildren } from './dom.js';
import { icon } from './icons.js';
import { PickerEngine, TEAM_COLORS, TEAM_NAMES } from '../logic/picker-engine.js';

const MODE_KEY = 'ludo.picker';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(MODE_KEY)) || {};
  } catch {
    return {};
  }
}

/** Ouvre le tirage. Retourne une fonction de fermeture. */
export function openPicker({ onClose, mode: initialMode } = {}) {
  const prefs = loadPrefs();
  const engine = new PickerEngine({
    mode: initialMode || prefs.mode || 'first',
    teamCount: prefs.teamCount || 2,
    random: secureRandom,
  });

  const canvas = h('canvas', { class: 'picker-canvas' });
  const hint = h('div', { class: 'picker-hint' });
  const modeBar = h('div', { class: 'picker-modes' });
  const root = h('div', { class: 'picker', role: 'application', 'aria-label': 'Tirage au doigt' },
    canvas,
    h('div', { class: 'picker-top' },
      h('button', { class: 'picker-close', 'aria-label': 'Fermer', onclick: () => close() }, icon('close', 28)),
      modeBar),
    hint);

  const renderModes = () => {
    setChildren(modeBar, 
      ...[
        ['first', 'Premier joueur'],
        ['order', 'Ordre'],
        ['teams', 'Équipes'],
      ].map(([m, label]) =>
        h('button', { class: engine.mode === m ? 'on' : '', onclick: () => setMode(m) }, label)),
      engine.mode === 'teams' &&
        h('div', { class: 'picker-teamcount' },
          ...[2, 3, 4].map((n) =>
            h('button', { class: engine.teamCount === n ? 'on' : '', 'aria-label': `${n} équipes`,
              onclick: () => setMode('teams', n) }, String(n)))),
    );
  };
  const setMode = (m, n = engine.teamCount) => {
    engine.setMode(m, n, performance.now());
    try { localStorage.setItem(MODE_KEY, JSON.stringify({ mode: m, teamCount: n })); } catch { /* */ }
    renderModes();
  };
  renderModes();

  // --- Entrées -----------------------------------------------------------------
  const now = () => performance.now();
  const block = (e) => e.preventDefault();
  const onTouch = (e) => {
    // Les boutons du haut gardent leur comportement normal.
    if (e.target.closest?.('button')) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (e.type === 'touchstart') engine.down(t.identifier, t.clientX, t.clientY, now());
      else if (e.type === 'touchmove') engine.move(t.identifier, t.clientX, t.clientY, now());
      else engine.up(t.identifier, now());
    }
  };
  const onPointer = (e) => {
    if (e.pointerType === 'touch' || e.target.closest?.('button')) return; // géré par les Touch Events
    const id = `p${e.pointerId}`;
    if (e.type === 'pointerdown') engine.down(id, e.clientX, e.clientY, now());
    else if (e.type === 'pointermove') engine.move(id, e.clientX, e.clientY, now());
    else engine.up(id, now());
  };

  const opts = { passive: false };
  for (const t of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) root.addEventListener(t, onTouch, opts);
  for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) root.addEventListener(t, onPointer);
  // Empêche zoom, défilement, menu contextuel (appui long) et gestes Safari.
  document.addEventListener('touchmove', block, opts);
  document.addEventListener('gesturestart', block, opts);
  document.addEventListener('gesturechange', block, opts);
  root.addEventListener('contextmenu', block);
  document.documentElement.classList.add('picker-open');

  // --- Rendu -------------------------------------------------------------------
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  const resize = () => {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  };
  resize();
  window.addEventListener('resize', resize);

  let raf = 0;
  let resultAt = 0;
  let lastPhase = engine.phase;

  const frame = () => {
    const t = now();
    if (engine.tick(t)) {
      if (engine.phase === 'countdown') vibrate(30);
      if (engine.phase === 'result') {
        resultAt = t;
        vibrate(engine.mode === 'first' ? [80, 60, 220] : 200);
      }
    }
    if (engine.phase !== lastPhase) lastPhase = engine.phase;
    draw(t);
    updateHint();
    raf = requestAnimationFrame(frame);
  };

  const updateHint = () => {
    const n = engine.activeTouches.length;
    let text = '';
    if (engine.phase === 'idle') {
      const need = engine.minTouches;
      text = n === 0
        ? (engine.mode === 'teams' ? `Posez chacun un doigt sur l’écran (au moins ${need})` : 'Posez chacun un doigt sur l’écran')
        : `Encore ${need - n > 0 ? need - n : 1} doigt${need - n > 1 ? 's' : ''}…`;
    } else if (engine.phase === 'settling') text = 'Ne bougez plus…';
    else if (engine.phase === 'countdown') text = '';
    else if (engine.phase === 'result') {
      if (engine.mode === 'first') text = 'C’est toi qui commences !';
      else if (engine.mode === 'order') text = 'Voici l’ordre de jeu';
      else text = 'Voici les équipes';
      if (n === 0) text += ' · Touchez pour recommencer';
    }
    if (hint.textContent !== text) hint.textContent = text;
  };

  const easeOut = (x) => 1 - (1 - x) ** 3;

  function draw(t) {
    const W = canvas.width;
    const H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const touches = [...engine.touches.values()];
    const R = Math.min(56, Math.max(40, Math.min(window.innerWidth, window.innerHeight) / 9));
    const res = engine.result;
    const sinceResult = engine.phase === 'result' ? (t - resultAt) / 1000 : 0;

    // Compte à rebours central
    const num = engine.countdownNumber(t);
    if (num) {
      const frac = (engine.progress(t) * 3) % 1;
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.25 * (1 - frac);
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${Math.round(Math.min(window.innerWidth, window.innerHeight) * (0.45 + 0.1 * frac))}px ui-rounded, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(num), window.innerWidth / 2, window.innerHeight / 2);
      ctx.restore();
    }

    for (const tc of touches) {
      const age = Math.min(1, (t - tc.bornAt) / 250);
      let r = R * easeOut(age);
      let alpha = 1;
      let color = tc.color;
      let label = null;

      if (res) {
        if (res.mode === 'first') {
          if (tc.id === res.winnerId) {
            r = R + (R * 1.8) * easeOut(Math.min(1, sinceResult / 0.6));
          } else {
            alpha = Math.max(0, 1 - sinceResult / 0.35);
            r = R * (1 - 0.5 * Math.min(1, sinceResult / 0.35));
          }
        } else if (res.mode === 'order') {
          const idx = res.order.indexOf(tc.id);
          if (idx >= 0 && sinceResult > idx * 0.35) label = String(idx + 1);
          r = R * 1.15;
        } else if (res.mode === 'teams') {
          const team = res.teams[tc.id];
          color = TEAM_COLORS[team % TEAM_COLORS.length];
          label = TEAM_NAMES[team].replace('Équipe ', '').slice(0, 1).toUpperCase();
          r = R * 1.15;
        }
        if (tc.lifted && res.mode !== 'first') alpha *= 0.85;
      }
      if (alpha <= 0) continue;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Halo pulsant
      const pulse = Math.sin(t / 220 + (typeof tc.id === 'number' ? tc.id : 0)) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.arc(tc.x, tc.y, r + 10 + pulse * 10, 0, Math.PI * 2);
      ctx.fillStyle = color + '40';
      ctx.fill();

      // Disque
      ctx.beginPath();
      ctx.arc(tc.x, tc.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 24;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Anneau de progression
      if (engine.phase === 'settling' || engine.phase === 'countdown') {
        const p = engine.phase === 'countdown' ? engine.progress(t) : engine.progress(t) * 0.15;
        ctx.beginPath();
        ctx.arc(tc.x, tc.y, r + 18, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      if (label) {
        ctx.fillStyle = '#1a1310';
        ctx.font = `800 ${Math.round(r * 0.95)}px ui-rounded, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, tc.x, tc.y + 2);
      }
      ctx.restore();
    }

    // Légende des équipes
    if (res?.mode === 'teams') {
      ctx.save();
      ctx.font = `700 16px ui-rounded, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const counts = {};
      Object.values(res.teams).forEach((k) => (counts[k] = (counts[k] || 0) + 1));
      Object.keys(counts).sort().forEach((k, i) => {
        const y = window.innerHeight - 120 - i * 28;
        ctx.fillStyle = TEAM_COLORS[k];
        ctx.beginPath();
        ctx.arc(28, y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(`${TEAM_NAMES[k]} (${TEAM_NAMES[k].replace('Équipe ', '').slice(0, 1).toUpperCase()}) · ${counts[k]}`, 46, y);
      });
      ctx.restore();
    }
  }

  document.body.append(root);
  raf = requestAnimationFrame(frame);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    document.removeEventListener('touchmove', block, opts);
    document.removeEventListener('gesturestart', block, opts);
    document.removeEventListener('gesturechange', block, opts);
    document.documentElement.classList.remove('picker-open');
    root.remove();
    onClose?.();
  }
  return close;
}
