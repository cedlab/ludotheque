// Petite simulation physique 2D du tapis de dés — module pur (testable).
// Unités : pixels et secondes. Les dés sont approchés par des cercles pour les
// collisions ; c'est imperceptible à l'œil et très stable.
//
// Le résultat de chaque dé est tiré AVANT l'animation (tirage équitable) :
// la simulation ne fait que « raconter » le lancer et s'arrête sur cette valeur.
import { rollDie } from './dice.js';

const RESTITUTION_WALL = 0.55;
const RESTITUTION_DICE = 0.6;
const LINEAR_DAMPING = 1.8; // freinage proportionnel à la vitesse (1/s)
const FRICTION = 360; // freinage constant du tapis (px/s²)
const ANGULAR_DAMPING = 2.6;
const STOP_SPEED = 14; // px/s
const FACE_STEP = 38; // distance parcourue (px) entre deux changements de face
const AIR_TIME = 0.32; // durée de la phase « en l'air » (s)
const MAX_TIME = 2.6; // au-delà, on freine fort pour conclure

export class DiceTable {
  constructor({ width = 320, height = 260, size = 64, faces = 6, random = Math.random } = {}) {
    Object.assign(this, { width, height, size, faces, random });
    this.dice = [];
    this.time = 0;
    this.rolling = false;
  }

  get radius() {
    return (this.size / 2) * 1.08;
  }

  resize(width, height, size = this.size) {
    this.width = width;
    this.height = height;
    this.size = size;
    const r = this.radius;
    for (const d of this.dice) {
      d.x = Math.min(width - r, Math.max(r, d.x));
      d.y = Math.min(height - r, Math.max(r, d.y));
    }
  }

  /** Dispose `count` dés en grille, sans valeur (avant le premier lancer). */
  layout(count, faces = this.faces) {
    this.faces = faces;
    const s = this.size * 1.35;
    const perRow = Math.max(1, Math.min(count, Math.floor(this.width / s)));
    const rows = Math.ceil(count / perRow);
    const top = this.height / 2 - ((rows - 1) * s) / 2;
    this.dice = Array.from({ length: count }, (_, i) => {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, count - row * perRow);
      const left = this.width / 2 - ((inRow - 1) * s) / 2;
      return this.#die(left + (i % perRow) * s, top + row * s, ((i * 37) % 13) - 6);
    });
    this.rolling = false;
  }

  #die(x, y, angle) {
    return { x, y, vx: 0, vy: 0, angle, va: 0, z: 0, value: null, final: null, held: false, moving: false, settled: true, travel: 0 };
  }

  /**
   * Lance les dés non gardés. `finals[i]` = valeur finale du dé i.
   * Retourne la liste des dés lancés.
   */
  throw(finals, held = new Set()) {
    const r = this.radius;
    const rnd = this.random;
    this.time = 0;
    this.rolling = true;
    const thrown = [];
    const placed = this.dice.filter((d, i) => held.has(i) && d.value !== null);

    this.dice.forEach((d, i) => {
      d.final = finals[i];
      d.held = held.has(i) && d.value !== null;
      if (d.held) {
        d.moving = false;
        d.vx = d.vy = d.va = 0;
        return;
      }
      // Départ depuis le bas du tapis, comme lancé par la main du joueur.
      let x;
      let y;
      for (let attempt = 0; attempt < 40; attempt++) {
        x = r + rnd() * (this.width - 2 * r);
        y = this.height - r - rnd() * Math.min(this.height * 0.35, r * 3);
        if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= 2 * r)) break;
      }
      d.x = x;
      d.y = y;
      const speed = this.height * (2.4 + rnd() * 1.4);
      const spread = (rnd() - 0.5) * 1.3; // angle autour de la verticale
      d.vx = Math.sin(spread) * speed + (this.width / 2 - x) * 0.8;
      d.vy = -Math.cos(spread) * speed;
      d.va = (rnd() < 0.5 ? -1 : 1) * (500 + rnd() * 900);
      d.z = 1;
      d.travel = 0;
      d.moving = true;
      d.settled = false;
      if (d.value === null) d.value = rollDie(this.faces, rnd);
      placed.push(d);
      thrown.push(d);
    });
    this.#separate();
    return thrown;
  }

  /** Écarte les dés qui se chevauchent (sans échange de vitesse). */
  #separate() {
    const r = this.radius;
    for (let pass = 0; pass < 6; pass++) {
      for (let i = 0; i < this.dice.length; i++) {
        for (let j = i + 1; j < this.dice.length; j++) {
          const a = this.dice[i];
          const b = this.dice[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.01;
          const overlap = 2 * r - dist;
          if (overlap <= 0) continue;
          const nx = dx / dist;
          const ny = dy / dist;
          const wa = a.held ? 0 : b.held ? 1 : 0.5;
          const wb = 1 - wa;
          if (a.held && b.held) continue;
          a.x -= nx * overlap * wa;
          a.y -= ny * overlap * wa;
          b.x += nx * overlap * wb;
          b.y += ny * overlap * wb;
        }
      }
      for (const d of this.dice) this.#clampToWalls(d, false);
    }
  }

  #clampToWalls(d, bounce = true) {
    const r = this.radius;
    let impact = 0;
    if (d.x < r) {
      d.x = r;
      if (bounce && d.vx < 0) { impact = Math.max(impact, -d.vx); d.vx = -d.vx * RESTITUTION_WALL; d.va *= -0.7; }
    } else if (d.x > this.width - r) {
      d.x = this.width - r;
      if (bounce && d.vx > 0) { impact = Math.max(impact, d.vx); d.vx = -d.vx * RESTITUTION_WALL; d.va *= -0.7; }
    }
    if (d.y < r) {
      d.y = r;
      if (bounce && d.vy < 0) { impact = Math.max(impact, -d.vy); d.vy = -d.vy * RESTITUTION_WALL; d.va *= -0.7; }
    } else if (d.y > this.height - r) {
      d.y = this.height - r;
      if (bounce && d.vy > 0) { impact = Math.max(impact, d.vy); d.vy = -d.vy * RESTITUTION_WALL; d.va *= -0.7; }
    }
    return impact;
  }

  /**
   * Avance la simulation de `dt` secondes.
   * Retourne { impacts: [force…], changed: bool, done: bool }.
   */
  step(dt) {
    if (!this.rolling) return { impacts: [], changed: false, done: true };
    const impacts = [];
    let changed = false;
    // Sous-pas pour la stabilité des collisions à grande vitesse.
    const sub = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / sub;
    for (let s = 0; s < sub; s++) {
      this.time += h;
      const late = this.time > MAX_TIME;
      for (const d of this.dice) {
        if (!d.moving) continue;
        // En l'air : pas de frottement du tapis.
        d.z = Math.max(0, d.z - h / AIR_TIME);
        const onFelt = d.z === 0;
        const damp = Math.exp(-(late ? 8 : LINEAR_DAMPING * (onFelt ? 1 : 0.3)) * h);
        d.vx *= damp;
        d.vy *= damp;
        const speed = Math.hypot(d.vx, d.vy);
        if (onFelt && speed > 0) {
          const dec = Math.min(speed, FRICTION * h);
          d.vx -= (d.vx / speed) * dec;
          d.vy -= (d.vy / speed) * dec;
        }
        d.va *= Math.exp(-(late ? 10 : ANGULAR_DAMPING) * h);
        d.x += d.vx * h;
        d.y += d.vy * h;
        d.angle += d.va * h;
        // Les faces défilent tant que le dé roule : vite au début, puis de plus en plus lentement.
        d.travel += Math.hypot(d.vx, d.vy) * h + Math.abs(d.va) * h * 0.25;
        // Un dé déjà posé puis bousculé garde sa valeur finale.
        if (!d.settled && d.travel >= FACE_STEP) {
          d.travel = 0;
          let v = rollDie(this.faces, this.random);
          if (this.faces > 1 && v === d.value) v = (v % this.faces) + 1;
          d.value = v;
          changed = true;
        }
        const wall = this.#clampToWalls(d);
        if (wall > 0) impacts.push(wall);
      }
      this.#collide(impacts);
      for (const d of this.dice) if (!d.held) this.#clampToWalls(d, false);
      // Arrêt : le dé se pose sur sa valeur finale, légèrement de travers.
      for (const d of this.dice) {
        if (d.moving && d.z === 0 && Math.hypot(d.vx, d.vy) < STOP_SPEED) {
          d.moving = false;
          d.vx = d.vy = d.va = 0;
          // Un dé à chiffres se pose à l'endroit (lisible) ; un D6 sur n'importe quel côté.
          const quarter = this.faces === 6 ? 90 : 360;
          if (!d.settled) d.angle = Math.round(d.angle / quarter) * quarter + (this.random() - 0.5) * 16;
          d.value = d.final;
          d.settled = true;
          changed = true;
        }
      }
    }
    const done = this.dice.every((d) => !d.moving);
    if (done) this.rolling = false;
    return { impacts, changed, done };
  }

  #collide(impacts) {
    const r = this.radius;
    for (let i = 0; i < this.dice.length; i++) {
      for (let j = i + 1; j < this.dice.length; j++) {
        const a = this.dice[i];
        const b = this.dice[j];
        if (!a.moving && !b.moving) continue;
        // Un dé encore « en l'air » passe au-dessus des autres.
        if (a.z > 0.35 || b.z > 0.35) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        if (dist >= 2 * r) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        // Un dé à l'arrêt est poussé (il se remet en mouvement) ; un dé gardé est immobile.
        const ia = a.held ? 0 : 1;
        const ib = b.held ? 0 : 1;
        if (ia + ib === 0) continue;
        const overlap = 2 * r - dist;
        a.x -= nx * overlap * (ia / (ia + ib));
        a.y -= ny * overlap * (ia / (ia + ib));
        b.x += nx * overlap * (ib / (ia + ib));
        b.y += ny * overlap * (ib / (ia + ib));
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel <= 0) continue;
        const jImp = ((1 + RESTITUTION_DICE) * rel) / (ia + ib);
        a.vx -= jImp * ia * nx;
        a.vy -= jImp * ia * ny;
        b.vx += jImp * ib * nx;
        b.vy += jImp * ib * ny;
        // Effet de rotation au choc
        const tangential = (a.vx - b.vx) * -ny + (a.vy - b.vy) * nx;
        if (ia) a.va += tangential * 0.8;
        if (ib) b.va -= tangential * 0.8;
        for (const d of [a, b]) {
          if (!d.held && !d.moving && Math.hypot(d.vx, d.vy) > STOP_SPEED) {
            d.moving = true;
          }
        }
        impacts.push(rel);
      }
    }
  }

  /** Termine immédiatement (mouvement réduit, ou écran quitté). */
  finish() {
    for (const d of this.dice) {
      if (d.final !== null) d.value = d.final;
      d.moving = false;
      d.vx = d.vy = d.va = 0;
      d.z = 0;
      d.settled = true;
    }
    this.rolling = false;
  }
}
