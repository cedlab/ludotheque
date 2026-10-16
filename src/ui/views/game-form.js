// Formulaire d'ajout / modification d'un jeu.
import { store, navigate, back } from '../../app.js';
import { h, setChildren } from '../dom.js';
import { icon } from '../icons.js';
import { gameLogo, header, stepper, toast } from '../components.js';
import { COUNTDOWN_WIN, MODES, MODE_LABELS, defaultScoring, normalizeScoring } from '../../logic/scoring.js';
import { cropImage, pickImageFile } from '../image.js';

const MODE_HELP = {
  highest: 'Le total le plus élevé l’emporte (Yams, Scrabble…).',
  lowest: 'Le total le plus faible l’emporte (Skyjo, Hearts…).',
  countdown: 'Chacun part d’un score (501, 20 PV…) et des points sont retirés.',
  target: 'Le premier à atteindre un nombre de points gagne (Uno, Belote…).',
  coop: 'Tout le groupe gagne ou perd ensemble (Pandémie, Hanabi…).',
};
const MODE_EMOJI = { highest: '⬆️', lowest: '⬇️', countdown: '⏬', target: '🎯', coop: '🤝' };

export function gameFormView({ id }) {
  const existing = id ? store.get('games', id) : null;
  if (id && !existing) {
    navigate('/', { replace: true });
    return h('div');
  }
  const g = {
    name: '', logo: null, minPlayers: 2, maxPlayers: 4, duration: 30, minAge: 8, notes: '',
    ...structuredClone(existing || {}),
  };
  g.scoring = normalizeScoring(g.scoring || defaultScoring());

  const logoBox = h('div', { class: 'logo-edit' });
  const nameInput = h('input', {
    class: 'input big', type: 'text', value: g.name, placeholder: 'Nom du jeu', required: true,
    maxlength: '60', autocomplete: 'off', 'aria-label': 'Nom du jeu',
    oninput: () => { g.name = nameInput.value; if (!g.logo) renderLogo(); },
  });

  const renderLogo = () => {
    setChildren(logoBox, 
      gameLogo({ name: g.name || '?', logo: g.logo }, 96),
      h('div', { class: 'stack tight' },
        h('button', { type: 'button', class: 'btn small', onclick: () => choosePhoto(true) }, icon('camera', 18), 'Prendre une photo'),
        h('button', { type: 'button', class: 'btn small', onclick: () => choosePhoto(false) }, icon('image', 18), 'Choisir une image'),
        g.logo && h('button', { type: 'button', class: 'btn small ghost', onclick: () => { g.logo = null; renderLogo(); } }, 'Icône automatique')));
  };
  const choosePhoto = async (camera) => {
    const file = await pickImageFile({ camera });
    if (!file) return;
    const data = await cropImage(file);
    if (data) {
      g.logo = data;
      renderLogo();
    }
  };
  renderLogo();

  // Joueurs min / max liés
  const minStep = stepper({ value: g.minPlayers, min: 1, max: 20, label: 'Joueurs minimum',
    onchange: (v) => { g.minPlayers = v; if (g.maxPlayers < v) maxStep.setValue((g.maxPlayers = v)); } });
  const maxStep = stepper({ value: g.maxPlayers, min: 1, max: 20, label: 'Joueurs maximum',
    onchange: (v) => { g.maxPlayers = v; if (g.minPlayers > v) minStep.setValue((g.minPlayers = v)); } });
  const durationStep = stepper({ value: g.duration || 0, min: 0, max: 600, step: 5, label: 'Durée',
    format: (v) => (v ? `${v} min` : '—'), onchange: (v) => (g.duration = v) });
  const ageStep = stepper({ value: g.minAge || 0, min: 0, max: 21, label: 'Âge minimum',
    format: (v) => (v ? `${v} ans` : '—'), onchange: (v) => (g.minAge = v) });

  // Type de score
  const scoringBox = h('div', { class: 'stack' });
  const renderScoring = () => {
    const sc = g.scoring;
    const numField = (label, key) => h('label', { class: 'field inline' }, h('span', null, label),
      h('input', { class: 'input num', type: 'number', inputmode: 'numeric', value: String(sc[key]),
        oninput: (e) => { sc[key] = Number(e.target.value) || 0; } }));
    const toggle = (label, key, help, disabled = false) => h('label', { class: `toggle ${disabled ? 'disabled' : ''}` },
      h('input', { type: 'checkbox', checked: sc[key], disabled, onchange: (e) => { sc[key] = e.target.checked; renderScoring(); } }),
      h('span', { class: 'toggle-ui' }),
      h('span', { class: 'toggle-text' }, h('strong', null, label), help && h('small', null, help)));

    setChildren(scoringBox, 
      h('div', { class: 'mode-grid', role: 'radiogroup', 'aria-label': 'Type de score' },
        Object.values(MODES).map((m) => h('button', {
          type: 'button', role: 'radio', 'aria-checked': String(sc.mode === m),
          class: `mode-card ${sc.mode === m ? 'on' : ''}`,
          onclick: () => { sc.mode = m; if (m === MODES.COOP) sc.teams = false; renderScoring(); },
        }, h('span', { class: 'mode-emoji' }, MODE_EMOJI[m]), h('strong', null, MODE_LABELS[m]), h('small', null, MODE_HELP[m])))),
      sc.mode === MODES.COUNTDOWN && h('div', { class: 'card inset stack' },
        numField('Score de départ', 'startScore'),
        h('div', { class: 'segmented' },
          [[COUNTDOWN_WIN.LAST_STANDING, 'Le dernier en vie gagne'], [COUNTDOWN_WIN.FIRST_TO_ZERO, 'Le premier à 0 gagne']].map(([v, l]) =>
            h('button', { type: 'button', class: sc.countdownWin === v ? 'on' : '', onclick: () => { sc.countdownWin = v; renderScoring(); } }, l)))),
      sc.mode === MODES.TARGET && h('div', { class: 'card inset' }, numField('Points à atteindre', 'target')),
      sc.mode === MODES.COOP && toggle('Noter un score de groupe', 'coopScore', 'Facultatif : points, niveau atteint…'),
      sc.mode !== MODES.COOP && toggle('Par équipes', 'teams', 'Les scores sont comptés par équipe.'),
      toggle('Saisie manche par manche', 'rounds', sc.rounds ? 'Le total est calculé automatiquement.' : 'Sinon, seul le score final est saisi.'),
    );
  };
  renderScoring();

  const notes = h('textarea', { class: 'input', rows: '4', placeholder: 'Règles maison, rappels, extensions…',
    oninput: () => (g.notes = notes.value) }, g.notes || '');

  const save = (e) => {
    e.preventDefault();
    g.name = nameInput.value.trim();
    if (!g.name) {
      toast('Donnez un nom au jeu.');
      nameInput.focus();
      return;
    }
    const rec = store.save('games', { ...g, scoring: normalizeScoring(g.scoring) });
    toast(existing ? 'Jeu modifié.' : `« ${rec.name} » ajouté à la ludothèque !`);
    navigate(`/jeu/${rec.id}`, { replace: true });
  };

  return h('form', { class: 'form', onsubmit: save },
    header(existing ? 'Modifier le jeu' : 'Nouveau jeu', { back: existing ? `#/jeu/${existing.id}` : '#/' }),
    h('section', { class: 'card stack' }, nameInput, logoBox),
    h('section', { class: 'card stack' },
      h('h3', null, 'Infos'),
      h('div', { class: 'field-row' }, h('span', null, 'Joueurs min.'), minStep),
      h('div', { class: 'field-row' }, h('span', null, 'Joueurs max.'), maxStep),
      h('div', { class: 'field-row' }, h('span', null, 'Durée'), durationStep),
      h('div', { class: 'field-row' }, h('span', null, 'Âge minimum'), ageStep)),
    h('section', { class: 'card stack' }, h('h3', null, 'Comptage des points'), scoringBox),
    h('section', { class: 'card stack' }, h('h3', null, 'Notes'), notes),
    h('div', { class: 'sticky-actions' },
      h('button', { type: 'button', class: 'btn ghost', onclick: () => back(existing ? `/jeu/${existing.id}` : '/') }, 'Annuler'),
      h('button', { type: 'submit', class: 'btn primary grow' }, icon('check'), 'Enregistrer')));
}
