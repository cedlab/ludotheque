// Logique de score — module pur (aucune dépendance au DOM), entièrement testé.
//
// Vocabulaire :
//  - « entrant » : ce qui reçoit un score. Un joueur, ou une équipe si le jeu
//    se joue par équipes.
//  - session.rounds : [{ [entrantId]: points }] — saisie manche par manche.
//  - session.finals : { [entrantId]: points } — score final uniquement.
//  - Pour le mode « décompte », les points saisis sont DÉDUITS du score de
//    départ (dégâts, fléchettes…) : restant = départ − total.

export const MODES = Object.freeze({
  HIGHEST: 'highest',
  LOWEST: 'lowest',
  COUNTDOWN: 'countdown',
  TARGET: 'target',
  COOP: 'coop',
});

export const COUNTDOWN_WIN = Object.freeze({
  FIRST_TO_ZERO: 'firstToZero',
  LAST_STANDING: 'lastStanding',
});

export const MODE_LABELS = {
  highest: 'Le plus haut gagne',
  lowest: 'Le plus bas gagne',
  countdown: 'Score de départ décompté',
  target: 'Score cible',
  coop: 'Coopératif',
};

export function defaultScoring() {
  return {
    mode: MODES.HIGHEST,
    teams: false,
    rounds: false,
    startScore: 20,
    countdownWin: COUNTDOWN_WIN.LAST_STANDING,
    target: 100,
    coopScore: false,
  };
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeScoring(s = {}) {
  const d = defaultScoring();
  const out = { ...d, ...s };
  if (!Object.values(MODES).includes(out.mode)) out.mode = d.mode;
  if (!Object.values(COUNTDOWN_WIN).includes(out.countdownWin)) out.countdownWin = d.countdownWin;
  out.teams = Boolean(out.teams) && out.mode !== MODES.COOP;
  out.rounds = Boolean(out.rounds);
  out.coopScore = Boolean(out.coopScore);
  out.startScore = num(out.startScore, d.startScore);
  out.target = num(out.target, d.target);
  return out;
}

/** Résumé lisible d'une configuration de score. */
export function describeScoring(s) {
  const sc = normalizeScoring(s);
  let txt = MODE_LABELS[sc.mode];
  if (sc.mode === MODES.COUNTDOWN) {
    txt += ` (départ ${sc.startScore}, ${
      sc.countdownWin === COUNTDOWN_WIN.FIRST_TO_ZERO ? 'le premier à 0 gagne' : 'le dernier en vie gagne'
    })`;
  } else if (sc.mode === MODES.TARGET) {
    txt += ` : ${sc.target} points`;
  } else if (sc.mode === MODES.COOP && sc.coopScore) {
    txt += ' avec score';
  }
  const extras = [];
  if (sc.teams) extras.push('par équipes');
  extras.push(sc.rounds ? 'manche par manche' : 'score final');
  return `${txt} · ${extras.join(' · ')}`;
}

/** Identifiants des entrants d'une session (équipes ou joueurs). */
export function entrantIds(session) {
  const sc = normalizeScoring(session.scoring);
  if (sc.teams) return (session.teams || []).map((t) => t.id);
  return (session.players || []).map((p) => p.id);
}

/** Total brut des points saisis pour chaque entrant. */
export function totals(scoring, session, ids = entrantIds(session)) {
  const sc = normalizeScoring(scoring);
  const out = {};
  for (const id of ids) out[id] = 0;
  if (sc.rounds) {
    for (const round of session.rounds || []) {
      for (const id of ids) out[id] += num(round?.[id]);
    }
  } else {
    for (const id of ids) out[id] = num(session.finals?.[id]);
  }
  return out;
}

/**
 * Cumuls après chaque manche : [{ id: cumul }]. En mode « score final »,
 * une seule « manche » virtuelle contenant le score final.
 */
export function cumulativeByRound(scoring, session, ids = entrantIds(session)) {
  const sc = normalizeScoring(scoring);
  const rounds = sc.rounds ? session.rounds || [] : [session.finals || {}];
  const acc = Object.fromEntries(ids.map((id) => [id, 0]));
  return rounds.map((round) => {
    for (const id of ids) acc[id] += num(round?.[id]);
    return { ...acc };
  });
}

/** Première manche (index) où `test(cumul)` devient vrai, sinon Infinity. */
function firstRoundWhere(cumuls, id, test) {
  for (let i = 0; i < cumuls.length; i++) if (test(cumuls[i][id])) return i;
  return Infinity;
}

/** Classement « compétition » : 1, 1, 3… à partir d'un comparateur. */
function rankWith(entries, compare) {
  const sorted = [...entries].sort(compare);
  let rank = 1;
  return sorted.map((e, i) => {
    if (i > 0 && compare(sorted[i - 1], e) !== 0) rank = i + 1;
    return { ...e, rank };
  });
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Calcule le résultat d'une session.
 *
 * Retourne :
 *  - ranking : [{ id, total, value, rank, ... }] trié du meilleur au moins bon
 *    (`value` = valeur à afficher : restant pour le décompte, total sinon)
 *  - winners : ids des gagnants (plusieurs en cas d'égalité)
 *  - tie : vrai s'il y a plusieurs gagnants (hors coopératif)
 *  - reached : vrai si la condition de victoire automatique est atteinte
 *    (score cible atteint, joueur à 0, dernier survivant, résultat coop saisi).
 *    Pour « plus haut / plus bas » la fin est décidée par les joueurs : false.
 */
export function computeResult(scoring, session) {
  const sc = normalizeScoring(scoring);
  const ids = entrantIds(session);
  const tot = totals(sc, session, ids);
  const cumuls = cumulativeByRound(sc, session, ids);

  if (ids.length === 0) return { ranking: [], winners: [], tie: false, reached: false };

  if (sc.mode === MODES.COOP) {
    const result = session.coop?.result ?? null;
    const score = num(session.coop?.score);
    return {
      ranking: ids.map((id) => ({ id, total: tot[id], value: tot[id], rank: 1 })),
      winners: result === 'win' ? [...ids] : [],
      tie: false,
      reached: result === 'win' || result === 'loss',
      coop: { result, score: sc.coopScore ? score : null },
    };
  }

  let ranking;
  let reached = false;

  switch (sc.mode) {
    case MODES.HIGHEST:
      ranking = rankWith(
        ids.map((id) => ({ id, total: tot[id], value: tot[id] })),
        (a, b) => cmp(b.total, a.total),
      );
      break;

    case MODES.LOWEST:
      ranking = rankWith(
        ids.map((id) => ({ id, total: tot[id], value: tot[id] })),
        (a, b) => cmp(a.total, b.total),
      );
      break;

    case MODES.TARGET: {
      // Le premier (en nombre de manches) à atteindre la cible gagne ; si
      // plusieurs l'atteignent dans la même manche, le plus haut l'emporte.
      const entries = ids.map((id) => {
        const r = firstRoundWhere(cumuls, id, (v) => v >= sc.target);
        return { id, total: tot[id], value: tot[id], reachedRound: r, atReach: r === Infinity ? null : cumuls[r][id] };
      });
      reached = entries.some((e) => e.reachedRound !== Infinity);
      ranking = rankWith(entries, (a, b) => {
        const byRound = cmp(a.reachedRound, b.reachedRound);
        if (byRound !== 0) return byRound;
        if (a.reachedRound !== Infinity) return cmp(b.atReach, a.atReach);
        return cmp(b.total, a.total);
      });
      break;
    }

    case MODES.COUNTDOWN: {
      const remainingAt = (v) => sc.startScore - v;
      const entries = ids.map((id) => {
        const zeroRound = firstRoundWhere(cumuls, id, (v) => remainingAt(v) <= 0);
        return { id, total: tot[id], value: sc.startScore - tot[id], zeroRound };
      });
      if (sc.countdownWin === COUNTDOWN_WIN.FIRST_TO_ZERO) {
        // Le premier à atteindre 0 gagne ; même manche = égalité.
        reached = entries.some((e) => e.zeroRound !== Infinity);
        ranking = rankWith(entries, (a, b) => {
          const byRound = cmp(a.zeroRound, b.zeroRound);
          if (byRound !== 0) return byRound;
          if (a.zeroRound !== Infinity) return 0;
          return cmp(a.value, b.value);
        });
      } else {
        // Dernier en vie : éliminé quand il tombe à 0. Les éliminés le plus
        // tard sont mieux classés ; éliminés dans la même manche = égalité.
        const alive = entries.filter((e) => e.zeroRound === Infinity);
        reached = ids.length >= 2 ? alive.length <= 1 : alive.length === 0;
        ranking = rankWith(entries, (a, b) => {
          const byRound = cmp(b.zeroRound, a.zeroRound);
          if (byRound !== 0) return byRound;
          if (a.zeroRound !== Infinity) return 0;
          return cmp(b.value, a.value);
        });
        for (const e of ranking) e.eliminated = e.zeroRound !== Infinity;
      }
      break;
    }

    default:
      throw new Error(`Mode de score inconnu : ${sc.mode}`);
  }

  const winners = ranking.filter((e) => e.rank === 1).map((e) => e.id);
  return { ranking, winners, tie: winners.length > 1, reached };
}

/** Joueurs gagnants (les équipes gagnantes sont développées en joueurs). */
export function winningPlayerIds(session, result = computeResult(session.scoring, session)) {
  const sc = normalizeScoring(session.scoring);
  const winners = new Set(result.winners);
  if (sc.teams) {
    return (session.players || []).filter((p) => winners.has(p.teamId)).map((p) => p.id);
  }
  return (session.players || []).filter((p) => winners.has(p.id)).map((p) => p.id);
}

/** Répartit des joueurs en `count` équipes équilibrées (aléatoire). */
export function randomTeams(playerIds, count, random = Math.random) {
  const ids = shuffle(playerIds, random);
  const teams = Array.from({ length: count }, () => []);
  ids.forEach((id, i) => teams[i % count].push(id));
  return teams;
}

/** Mélange de Fisher–Yates (retourne une copie). */
export function shuffle(list, random = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
