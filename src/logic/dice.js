// Lancer de dés — module pur.

export const DICE_FACES = [4, 6, 8, 10, 12, 20, 100];
export const MAX_DICE = 12;

export function normalizeDice(d) {
  if (!d) return null;
  const count = Math.min(MAX_DICE, Math.max(1, Math.round(Number(d.count) || 1)));
  const faces = DICE_FACES.includes(Number(d.faces)) ? Number(d.faces) : 6;
  return { count, faces };
}

export const describeDice = (d) => `${d.count} × D${d.faces}`;

/** Une valeur entre 1 et `faces`. */
export function rollDie(faces, random = Math.random) {
  return 1 + Math.min(faces - 1, Math.floor(random() * faces));
}

/**
 * Lance `count` dés à `faces` faces. Les dés dont l'index est dans `held`
 * gardent leur valeur précédente (`previous`).
 */
export function rollDice(count, faces, { random = Math.random, held = [], previous = [] } = {}) {
  const keep = new Set(held);
  return Array.from({ length: count }, (_, i) =>
    keep.has(i) && Number.isFinite(previous[i]) ? previous[i] : rollDie(faces, random));
}

export function sumDice(values) {
  return values.reduce((a, b) => a + b, 0);
}
