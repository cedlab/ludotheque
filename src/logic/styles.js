// Styles de jeu (un jeu peut en avoir plusieurs) — module pur.

export const GAME_STYLES = [
  { id: 'strategie', label: 'Stratégie', emoji: '♟️' },
  { id: 'famille', label: 'Familial', emoji: '🏡' },
  { id: 'ambiance', label: 'Ambiance', emoji: '🎉' },
  { id: 'cartes', label: 'Cartes', emoji: '🃏' },
  { id: 'des', label: 'Dés', emoji: '🎲' },
  { id: 'coop', label: 'Coopératif', emoji: '🤝' },
  { id: 'reflexion', label: 'Réflexion', emoji: '🧩' },
  { id: 'rapidite', label: 'Rapidité', emoji: '⚡' },
  { id: 'bluff', label: 'Bluff & déduction', emoji: '🕵️' },
  { id: 'mots', label: 'Mots', emoji: '🔤' },
  { id: 'quiz', label: 'Quiz', emoji: '❓' },
  { id: 'enfants', label: 'Enfants', emoji: '🧸' },
];

const IDS = new Set(GAME_STYLES.map((s) => s.id));

export const styleById = (id) => GAME_STYLES.find((s) => s.id === id) || null;

export function normalizeStyles(styles) {
  if (!Array.isArray(styles)) return [];
  return GAME_STYLES.map((s) => s.id).filter((id) => styles.includes(id));
}

/** Styles d'un jeu ; un jeu au comptage coopératif est toujours « Coopératif ». */
export function gameStyles(game) {
  const styles = new Set(normalizeStyles(game?.styles));
  if (game?.scoring?.mode === 'coop') styles.add('coop');
  return GAME_STYLES.map((s) => s.id).filter((id) => styles.has(id));
}

export function gameHasStyle(game, styleId) {
  if (!styleId || !IDS.has(styleId)) return true;
  return gameStyles(game).includes(styleId);
}

/**
 * Filtre multi-styles. mode 'any' : au moins un des styles ; 'all' : tous.
 * Aucun style choisi : tout passe.
 */
export function gameMatchesStyles(game, styleIds = [], mode = 'any') {
  const wanted = normalizeStyles(styleIds);
  if (wanted.length === 0) return true;
  const own = new Set(gameStyles(game));
  return mode === 'all' ? wanted.every((id) => own.has(id)) : wanted.some((id) => own.has(id));
}
