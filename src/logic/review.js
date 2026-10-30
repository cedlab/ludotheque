// Avis de la famille sur un jeu : note en étoiles (demi-étoiles comprises) et commentaire — module pur.

export const MAX_STARS = 5;

const LABELS = ['', 'Pas pour nous', 'Bof', 'Sympa', 'Très bien', 'Coup de cœur'];

/** Appréciation d'une note : 4,5 reste « Très bien », seul 5 est un « Coup de cœur ». */
export const ratingLabel = (rating) => (rating > 0 ? LABELS[Math.max(1, Math.floor(rating))] : '');

/** Note à la demi-étoile près, entre 0 (pas de note) et 5. */
export const normalizeRating = (value) => Math.max(0, Math.min(MAX_STARS, Math.round((Number(value) || 0) * 2) / 2));

/** Avis propre : note et commentaire ; null s'il est vide. */
export function normalizeReview(review) {
  if (!review || typeof review !== 'object') return null;
  const rating = normalizeRating(review.rating);
  const comment = typeof review.comment === 'string' ? review.comment.trim() : '';
  if (!rating && !comment) return null;
  return { rating, comment, at: Number(review.at) || 0 };
}

/** Note d'un jeu (0 s'il n'est pas noté). */
export const gameRating = (game) => normalizeReview(game?.review)?.rating || 0;

/** « 4,5 » plutôt que « 4.5 ». */
export const formatRating = (rating) => String(rating).replace('.', ',');

/** Remplissage de chaque étoile : 1 pleine, 0.5 à moitié, 0 vide. */
export const starFills = (rating) =>
  Array.from({ length: MAX_STARS }, (_, i) => Math.max(0, Math.min(1, rating - i)));

/**
 * Filtre « Note » : null = tous, -1 = pas encore notés, n = au moins n étoiles.
 */
export function gameMatchesRating(game, min) {
  if (min == null) return true;
  const r = gameRating(game);
  return min === -1 ? r === 0 : r >= min;
}
