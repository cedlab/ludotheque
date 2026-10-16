// Composants d'interface réutilisables.
import { h } from './dom.js';
import { icon } from './icons.js';

// --- Couleurs & avatars -------------------------------------------------------

export const PLAYER_COLORS = [
  '#E8743B', '#E5484D', '#D6409F', '#8E4EC6', '#3E63DD',
  '#0090FF', '#12A594', '#30A46C', '#94BA2C', '#F5B700', '#AD7F58', '#6F6E77',
];
export const AVATARS = [
  '🦊', '🐻', '🐼', '🐸', '🦁', '🐯', '🐨', '🐙', '🦄', '🐲', '🐧', '🦉',
  '🐢', '🐝', '🦖', '🐱', '🐶', '🐰', '🐵', '🦔', '🐳', '🦜', '🌟', '👾',
];

function hashString(s) {
  let x = 2166136261;
  for (const c of String(s)) x = Math.imul(x ^ c.codePointAt(0), 16777619);
  return x >>> 0;
}

const LOGO_COLORS = ['#E8743B', '#2A9D8F', '#8E4EC6', '#E5484D', '#3E63DD', '#D49A00', '#30A46C', '#D6409F', '#0090FF', '#AD7F58'];

const SMALL_WORDS = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd', 'et', 'en', 'au', 'aux', 'the', 'of', 'a', 'jeu']);

export function initials(name = '') {
  const all = name.trim().split(/[\s\-–_'’:!?.,()]+/).filter(Boolean);
  if (all.length === 0) return '?';
  // On ignore les petits mots (« Les Aventuriers du Rail » → A…R)
  const words = all.filter((w) => !SMALL_WORDS.has(w.toLowerCase()));
  const w = words.length ? words : all;
  if (w.length === 1) return [...w[0]].slice(0, 2).join('').toUpperCase();
  return (([...w[0]][0] || '') + ([...w[w.length - 1]][0] || '')).toUpperCase();
}

export function autoLogoColor(name) {
  return LOGO_COLORS[hashString(name.trim().toLowerCase()) % LOGO_COLORS.length];
}

/** Logo d'un jeu : photo si disponible, sinon initiales sur couleur générée. */
export function gameLogo(game, size = 64) {
  const style = { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.38)}px` };
  if (game?.logo) {
    return h('img', { class: 'logo', src: game.logo, alt: '', style, draggable: 'false' });
  }
  const name = game?.name || '?';
  const color = autoLogoColor(name);
  return h('div', { class: 'logo logo-auto', style: { ...style, '--c': color }, 'aria-hidden': 'true' }, initials(name));
}

export function avatar(player, size = 40) {
  const color = player?.color || '#999';
  return h(
    'span',
    {
      class: 'avatar',
      style: { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.55)}px`, '--c': color },
      'aria-hidden': 'true',
    },
    player?.avatar || initials(player?.name || '?'),
  );
}

// --- Notifications ------------------------------------------------------------

let toastTimer;
export function toast(message, { action, onAction, duration = 3500 } = {}) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const el = h(
    'div',
    { class: 'toast', role: 'status' },
    h('span', null, message),
    action && h('button', { class: 'toast-action', onclick: () => { el.remove(); onAction?.(); } }, action),
  );
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  if (duration) toastTimer = setTimeout(() => el.remove(), duration);
  return el;
}

// --- Feuilles modales (bottom sheets) ----------------------------------------

/** Ouvre une feuille modale. Retourne { el, close }. */
export function sheet(content, { title, onClose, className = '' } = {}) {
  const prevFocus = document.activeElement;
  const close = () => {
    backdrop.classList.remove('show');
    setTimeout(() => backdrop.remove(), 200);
    document.removeEventListener('keydown', onKey);
    prevFocus?.focus?.();
    onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  const panel = h(
    'div',
    { class: `sheet ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' },
    h('div', { class: 'sheet-grip' }),
    title && h('div', { class: 'sheet-head' }, h('h2', null, title),
      h('button', { class: 'icon-btn', 'aria-label': 'Fermer', onclick: () => close() }, icon('close'))),
    h('div', { class: 'sheet-body' }, content),
  );
  const backdrop = h('div', { class: 'backdrop', onclick: (e) => e.target === backdrop && close() }, panel);
  document.body.append(backdrop);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => backdrop.classList.add('show'));
  return { el: panel, close };
}

export function confirmDialog(message, { ok = 'Confirmer', cancel = 'Annuler', danger = false, title } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const done = (v) => {
      if (answered) return;
      answered = true;
      s.close();
      resolve(v);
    };
    const s = sheet(
      h('div', { class: 'stack' },
        h('p', { class: 'confirm-msg' }, message),
        h('div', { class: 'row gap' },
          h('button', { class: 'btn ghost grow', onclick: () => done(false) }, cancel),
          h('button', { class: `btn grow ${danger ? 'danger' : 'primary'}`, onclick: () => done(true) }, ok))),
      { title, onClose: () => done(false) },
    );
  });
}

/** Saisie d'un nombre (clavier numérique, bouton ± car iOS n'a pas de « − »). */
export function promptNumber({ title, value = 0, allowNegative = true, hint } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    let negative = value < 0;
    const input = h('input', {
      class: 'num-input', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off',
      value: value ? String(Math.abs(value)) : '', placeholder: '0', 'aria-label': title,
    });
    const signBtn = allowNegative && h('button', { class: 'btn sign', type: 'button', onclick: () => {
      negative = !negative;
      signBtn.textContent = negative ? '−' : '+';
      input.focus();
    } }, negative ? '−' : '+');
    const done = (v) => {
      if (answered) return;
      answered = true;
      s.close();
      resolve(v);
    };
    const submit = (e) => {
      e?.preventDefault();
      const n = parseInt(input.value.replace(/[^0-9]/g, ''), 10);
      done(Number.isFinite(n) ? (negative ? -n : n) : 0);
    };
    const s = sheet(
      h('form', { class: 'stack', onsubmit: submit },
        hint && h('p', { class: 'muted' }, hint),
        h('div', { class: 'row gap center' }, signBtn, input),
        h('button', { class: 'btn primary big', type: 'submit' }, 'Valider')),
      { title, onClose: () => done(null) },
    );
    setTimeout(() => input.focus(), 80);
  });
}

// --- Petits contrôles ----------------------------------------------------------

/** Compteur − valeur + pour formulaires. L'élément expose `setValue(v)`. */
export function stepper({ value, min = 0, max = 99, step = 1, onchange, label, format = (v) => v }) {
  let v = value;
  const out = h('output', { class: 'stepper-value' }, format(v));
  const show = (nv) => {
    v = Math.min(max, Math.max(min, nv));
    out.textContent = format(v);
  };
  const set = (nv) => {
    show(nv);
    onchange?.(v);
  };
  const el = h('div', { class: 'stepper', role: 'group', 'aria-label': label },
    h('button', { type: 'button', class: 'step-btn', 'aria-label': `${label} : moins`, onclick: () => set(v - step) }, icon('minus', 20)),
    out,
    h('button', { type: 'button', class: 'step-btn', 'aria-label': `${label} : plus`, onclick: () => set(v + step) }, icon('plus', 20)));
  el.setValue = show;
  return el;
}

/** Contrôle segmenté. options : [{ value, label }] */
export function segmented(options, current, onchange, { className = '' } = {}) {
  const wrap = h('div', { class: `segmented ${className}`, role: 'radiogroup' });
  for (const o of options) {
    const b = h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(o.value === current),
      class: o.value === current ? 'on' : '',
      onclick: () => {
        wrap.querySelectorAll('button').forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
        b.classList.add('on');
        b.setAttribute('aria-checked', 'true');
        onchange(o.value);
      },
    }, o.label);
    wrap.append(b);
  }
  return wrap;
}

export function emptyState(emoji, title, text, ...actions) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty-emoji' }, emoji),
    h('h3', null, title),
    text && h('p', { class: 'muted' }, text),
    actions.length > 0 && h('div', { class: 'stack' }, actions));
}

export function header(title, { back, lead, actions = [] } = {}) {
  return h('header', { class: 'topbar' },
    back
      ? h('a', { class: 'icon-btn', href: back, 'aria-label': 'Retour' }, icon('back'))
      : h('span', { class: 'topbar-spacer' }, lead),
    h('h1', null, title),
    h('div', { class: 'topbar-actions' }, actions));
}
