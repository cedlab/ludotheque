// Avis de la famille sur un jeu (surtout ceux testés ailleurs) — module pur.

export const MAX_STARS = 5;

export const RATING_LABELS = ['', 'Pas pour nous', 'Bof', 'Sympa', 'Très bien', 'Coup de cœur'];

/** Avis propre : note de 0 (aucune) à 5 et commentaire ; null s'il est vide. */
export function normalizeReview(review) {
  if (!review || typeof review !== 'object') return null;
  const rating = Math.max(0, Math.min(MAX_STARS, Math.round(Number(review.rating) || 0)));
  const comment = typeof review.comment === 'string' ? review.comment.trim() : '';
  if (!rating && !comment) return null;
  return { rating, comment, at: Number(review.at) || 0 };
}

export const stars = (rating) => '★'.repeat(rating) + '☆'.repeat(MAX_STARS - rating);
