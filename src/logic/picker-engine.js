// Moteur du tirage au doigt — sans DOM, piloté par des événements et une horloge
// injectée (testable). L'écran (ui/picker.js) ne fait que l'alimenter et dessiner.
//
// Phases : idle → settling (doigts immobiles) → countdown → result
// Tout ajout, retrait ou déplacement notable d'un doigt avant le résultat
// relance la phase « settling ».
import { shuffle } from './scoring.js';

export const PICKER_COLORS = [
  '#FF5D5D', '#FFB13B', '#FFE14D', '#5BD67A', '#3CC8E8',
  '#5B7CFA', '#B26BFF', '#FF6FC0', '#FF8A5C', '#9BE15D', '#2EE6C5',
];
export const TEAM_COLORS = ['#FF5D5D', '#3C9BFF', '#5BD67A', '#FFC93C'];
export const TEAM_NAMES = ['Équipe rouge', 'Équipe bleue', 'Équipe verte', 'Équipe jaune'];

export class PickerEngine {
  constructor({
    mode = 'first', // 'first' | 'order' | 'teams'
    teamCount = 2,
    settleMs = 2000,
    countdownMs = 2400,
    moveTolerance = 28,
    random = Math.random,
  } = {}) {
    Object.assign(this, { mode, teamCount, settleMs, countdownMs, moveTolerance, random });
    this.reset(0);
  }

  reset(now = 0) {
    this.touches = new Map();
    this.phase = 'idle';
    this.phaseStart = now;
    this.result = null;
    this.colorIndex = 0;
  }

  get minTouches() {
    return this.mode === 'teams' ? Math.max(2, this.teamCount) : 2;
  }

  get activeTouches() {
    return [...this.touches.values()].filter((t) => !t.lifted);
  }

  setMode(mode, teamCount = this.teamCount, now = 0) {
    this.mode = mode;
    this.teamCount = teamCount;
    this.reset(now);
  }

  #nextColor() {
    const used = new Set(this.activeTouches.map((t) => t.color));
    const free = PICKER_COLORS.find((c) => !used.has(c));
    return free || PICKER_COLORS[this.colorIndex++ % PICKER_COLORS.length];
  }

  #restart(now) {
    this.phase = this.activeTouches.length >= this.minTouches ? 'settling' : 'idle';
    this.phaseStart = now;
    for (const t of this.activeTouches) {
      t.ax = t.x;
      t.ay = t.y;
    }
  }

  down(id, x, y, now) {
    if (this.phase === 'result') {
      // Résultat affiché : on n'en relance un nouveau qu'une fois tous les doigts levés.
      if (this.activeTouches.length > 0) return;
      this.reset(now);
    }
    this.touches.set(id, { id, x, y, ax: x, ay: y, color: this.#nextColor(), bornAt: now, lifted: false });
    this.#restart(now);
  }

  move(id, x, y, now) {
    const t = this.touches.get(id);
    if (!t || t.lifted) return;
    t.x = x;
    t.y = y;
    if (this.phase === 'result') return;
    if (Math.hypot(x - t.ax, y - t.ay) > this.moveTolerance) this.#restart(now);
  }

  up(id, now) {
    const t = this.touches.get(id);
    if (!t) return;
    if (this.phase === 'result') {
      t.lifted = true;
      return;
    }
    this.touches.delete(id);
    this.#restart(now);
  }

  /** Avance l'horloge. Retourne true si la phase vient de changer. */
  tick(now) {
    if (this.phase === 'settling' && now - this.phaseStart >= this.settleMs) {
      this.phase = 'countdown';
      this.phaseStart = now;
      return true;
    }
    if (this.phase === 'countdown' && now - this.phaseStart >= this.countdownMs) {
      this.#draw();
      this.phase = 'result';
      this.phaseStart = now;
      return true;
    }
    return false;
  }

  /** Progression 0→1 de la phase en cours. */
  progress(now) {
    const d = this.phase === 'settling' ? this.settleMs : this.phase === 'countdown' ? this.countdownMs : 1;
    return Math.min(1, Math.max(0, (now - this.phaseStart) / d));
  }

  /** Chiffre du compte à rebours (3, 2, 1) ou null. */
  countdownNumber(now) {
    if (this.phase !== 'countdown') return null;
    const steps = 3;
    return Math.max(1, steps - Math.floor(this.progress(now) * steps));
  }

  #draw() {
    const ids = this.activeTouches.map((t) => t.id);
    const order = shuffle(ids, this.random);
    const result = { mode: this.mode, winnerId: order[0], order, teams: null };
    if (this.mode === 'teams') {
      result.teams = {};
      order.forEach((id, i) => (result.teams[id] = i % this.teamCount));
      for (const id of ids) this.touches.get(id).color = TEAM_COLORS[result.teams[id] % TEAM_COLORS.length];
    }
    this.result = result;
  }
}
