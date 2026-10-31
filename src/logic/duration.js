// Durée réelle d'une partie, pauses déduites — module pur.
//   pausedMs : total des pauses terminées
//   pausedAt : début de la pause en cours (null si la partie tourne)

export const isPaused = (s) => Boolean(s?.pausedAt);

/** Temps de jeu effectif (ms) à l'instant `now`, ou à la fin de la partie si elle est terminée. */
export function playedMs(s, now = Date.now()) {
  if (!Number.isFinite(s?.startedAt)) return 0;
  const end = s.endedAt || now;
  const currentPause = s.pausedAt ? Math.max(0, end - s.pausedAt) : 0;
  return Math.max(0, end - s.startedAt - (Number(s.pausedMs) || 0) - currentPause);
}

/** Total des pauses (ms), y compris celle en cours. */
export function pausedTotal(s, now = Date.now()) {
  const end = s?.endedAt || now;
  return (Number(s?.pausedMs) || 0) + (s?.pausedAt ? Math.max(0, end - s.pausedAt) : 0);
}

/** Met la partie en pause (champs à fusionner dans la partie). */
export const pauseFields = (s, now = Date.now()) => (s.pausedAt ? {} : { pausedAt: now });

/** Reprend la partie : la pause en cours s'ajoute au total. */
export function resumeFields(s, now = Date.now()) {
  if (!s.pausedAt) return {};
  return { pausedAt: null, pausedMs: (Number(s.pausedMs) || 0) + Math.max(0, now - s.pausedAt) };
}

/**
 * Partie terminée puis rouverte : le temps passé « terminée » ne compte pas,
 * il est ajouté aux pauses.
 */
export function reopenFields(s, now = Date.now()) {
  const gap = s.endedAt ? Math.max(0, now - s.endedAt) : 0;
  return { status: 'playing', endedAt: null, pausedAt: null, pausedMs: (Number(s.pausedMs) || 0) + gap };
}

/** Termine la partie : une pause en cours se termine au même instant. */
export function finishFields(s, now = Date.now()) {
  return { ...resumeFields(s, now), status: 'finished', endedAt: now };
}
