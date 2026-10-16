// Statistiques — module pur.
import { MODES, computeResult, normalizeScoring, winningPlayerIds } from './scoring.js';

export const sessionDate = (s) => s.endedAt || s.startedAt || s.createdAt || 0;

export function finishedSessions(sessions) {
  return sessions.filter((s) => !s.deleted && s.status === 'finished').sort((a, b) => sessionDate(a) - sessionDate(b));
}

/** Gagnants (joueurs) d'une session terminée. */
export function sessionWinners(session) {
  return winningPlayerIds(session, computeResult(session.scoring, session));
}

/**
 * Statistiques globales.
 * @returns {{
 *   totalSessions: number,
 *   players: Record<string, {played:number, wins:number, coopPlayed:number, coopWins:number, currentStreak:number, bestStreak:number}>,
 *   games: {gameId:string, name:string, count:number}[],
 *   bestScores: {gameId:string, name:string, mode:string, value:number, holders:string[]}[],
 * }}
 */
export function computeStats({ sessions = [], games = [] } = {}) {
  const done = finishedSessions(sessions);
  const players = {};
  const ensure = (id) =>
    (players[id] ??= { played: 0, wins: 0, coopPlayed: 0, coopWins: 0, currentStreak: 0, bestStreak: 0 });

  const gameCount = new Map();
  const gameNames = new Map(games.filter((g) => !g.deleted).map((g) => [g.id, g.name]));
  const best = new Map();

  for (const s of done) {
    const sc = normalizeScoring(s.scoring);
    const result = computeResult(sc, s);
    const winners = new Set(winningPlayerIds(s, result));
    const isCoop = sc.mode === MODES.COOP;

    for (const p of s.players || []) {
      const st = ensure(p.id);
      const won = winners.has(p.id);
      if (isCoop) {
        st.coopPlayed++;
        if (won) st.coopWins++;
      } else {
        st.played++;
        if (won) st.wins++;
      }
      // Série : parties consécutives (toutes confondues) remportées.
      st.currentStreak = won ? st.currentStreak + 1 : 0;
      st.bestStreak = Math.max(st.bestStreak, st.currentStreak);
    }

    const name = gameNames.get(s.gameId) || s.gameName || 'Jeu supprimé';
    gameCount.set(s.gameId, { gameId: s.gameId, name, count: (gameCount.get(s.gameId)?.count || 0) + 1 });

    // Meilleur score
    const candidates = bestScoreCandidates(s, sc, result);
    for (const c of candidates) {
      const cur = best.get(s.gameId);
      const better = !cur || (sc.mode === MODES.LOWEST ? c.value < cur.value : c.value > cur.value);
      if (better) best.set(s.gameId, { gameId: s.gameId, name, mode: sc.mode, value: c.value, holders: [c.name] });
      else if (cur.value === c.value && !cur.holders.includes(c.name)) cur.holders.push(c.name);
    }
  }

  return {
    totalSessions: done.length,
    players,
    games: [...gameCount.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    bestScores: [...best.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function entrantName(session, id) {
  const team = (session.teams || []).find((t) => t.id === id);
  if (team) return team.name;
  return (session.players || []).find((p) => p.id === id)?.name || '?';
}

function bestScoreCandidates(session, sc, result) {
  if (sc.mode === MODES.COOP) {
    if (!sc.coopScore || result.coop?.score == null) return [];
    return [{ value: result.coop.score, name: 'Équipe' }];
  }
  // Décompte : on retient le plus grand nombre de points restants.
  return result.ranking.map((e) => ({ value: e.value, name: entrantName(session, e.id) }));
}

/** Historique filtré, du plus récent au plus ancien. */
export function filterHistory(sessions, { gameId = null, playerId = null } = {}) {
  return finishedSessions(sessions)
    .filter((s) => !gameId || s.gameId === gameId)
    .filter((s) => !playerId || (s.players || []).some((p) => p.id === playerId))
    .reverse();
}
