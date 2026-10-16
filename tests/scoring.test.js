import { describe, expect, it } from 'vitest';
import {
  computeResult,
  describeScoring,
  normalizeScoring,
  randomTeams,
  totals,
  winningPlayerIds,
} from '../src/logic/scoring.js';

const players = (...ids) => ids.map((id) => ({ id, name: id.toUpperCase(), teamId: null }));

function session(scoring, data = {}, ids = ['a', 'b', 'c']) {
  return { scoring: normalizeScoring(scoring), players: players(...ids), teams: [], rounds: [], finals: {}, ...data };
}
const result = (s) => computeResult(s.scoring, s);
const order = (r) => r.ranking.map((e) => e.id);
const ranks = (r) => Object.fromEntries(r.ranking.map((e) => [e.id, e.rank]));

describe('configuration', () => {
  it('normalise une configuration incomplète ou invalide', () => {
    const sc = normalizeScoring({ mode: 'nimporte', startScore: 'abc', target: '50' });
    expect(sc.mode).toBe('highest');
    expect(sc.startScore).toBe(20);
    expect(sc.target).toBe(50);
  });
  it('désactive les équipes en coopératif', () => {
    expect(normalizeScoring({ mode: 'coop', teams: true }).teams).toBe(false);
  });
  it('décrit la configuration en français', () => {
    expect(describeScoring({ mode: 'countdown', startScore: 501, countdownWin: 'firstToZero', rounds: true }))
      .toBe('Score de départ décompté (départ 501, le premier à 0 gagne) · manche par manche');
    expect(describeScoring({ mode: 'target', target: 500, teams: true }))
      .toBe('Score cible : 500 points · par équipes · score final');
  });
});

describe('manches et totaux', () => {
  it('additionne automatiquement les manches', () => {
    const s = session({ rounds: true }, { rounds: [{ a: 3, b: 5 }, { a: 10, b: -2, c: 4 }, { a: 1 }] });
    expect(totals(s.scoring, s)).toEqual({ a: 14, b: 3, c: 4 });
  });
  it('utilise le score final quand la saisie par manche est désactivée', () => {
    const s = session({ rounds: false }, { finals: { a: 7, b: 9 }, rounds: [{ a: 100 }] });
    expect(totals(s.scoring, s)).toEqual({ a: 7, b: 9, c: 0 });
  });
  it('ignore les valeurs non numériques', () => {
    const s = session({ rounds: true }, { rounds: [{ a: '4', b: 'x', c: null }] });
    expect(totals(s.scoring, s)).toEqual({ a: 4, b: 0, c: 0 });
  });
});

describe('le plus haut gagne', () => {
  it('classe du plus haut au plus bas', () => {
    const r = result(session({ mode: 'highest' }, { finals: { a: 10, b: 30, c: 20 } }));
    expect(order(r)).toEqual(['b', 'c', 'a']);
    expect(r.winners).toEqual(['b']);
    expect(r.tie).toBe(false);
    expect(r.reached).toBe(false);
  });
  it('gère les égalités (classement 1, 1, 3)', () => {
    const r = result(session({ mode: 'highest' }, { finals: { a: 30, b: 30, c: 20 } }));
    expect(r.winners.sort()).toEqual(['a', 'b']);
    expect(r.tie).toBe(true);
    expect(ranks(r)).toEqual({ a: 1, b: 1, c: 3 });
  });
  it('fonctionne manche par manche', () => {
    const r = result(session({ mode: 'highest', rounds: true }, { rounds: [{ a: 5, b: 1 }, { b: 10 }] }));
    expect(r.winners).toEqual(['b']);
  });
});

describe('le plus bas gagne', () => {
  it('classe du plus bas au plus haut', () => {
    const r = result(session({ mode: 'lowest', rounds: true }, { rounds: [{ a: 12, b: 25, c: 8 }, { a: 18, b: 3, c: 30 }] }));
    expect(order(r)).toEqual(['b', 'a', 'c']);
    expect(r.winners).toEqual(['b']);
  });
  it('gère les égalités au plus bas', () => {
    const r = result(session({ mode: 'lowest' }, { finals: { a: 4, b: 9, c: 4 } }));
    expect(r.winners.sort()).toEqual(['a', 'c']);
    expect(ranks(r)).toEqual({ a: 1, c: 1, b: 3 });
  });
  it('accepte les scores négatifs', () => {
    const r = result(session({ mode: 'lowest' }, { finals: { a: -3, b: 0, c: 2 } }));
    expect(r.winners).toEqual(['a']);
  });
});

describe('score de départ décompté — le premier à 0 gagne', () => {
  const sc = { mode: 'countdown', startScore: 501, countdownWin: 'firstToZero', rounds: true };
  it('affiche les points restants', () => {
    const r = result(session(sc, { rounds: [{ a: 100, b: 60, c: 0 }] }));
    expect(r.ranking.find((e) => e.id === 'a').value).toBe(401);
    expect(order(r)).toEqual(['a', 'b', 'c']); // le plus proche de 0 en tête
    expect(r.reached).toBe(false);
  });
  it('le premier à atteindre 0 gagne, même si un autre y arrive plus tard', () => {
    const r = result(session(sc, {
      rounds: [{ a: 301, b: 400 }, { a: 200, b: 50 }, { a: 0, b: 51 }],
    }));
    expect(r.reached).toBe(true);
    expect(r.winners).toEqual(['a']);
    expect(order(r)[1]).toBe('b');
  });
  it('égalité si plusieurs atteignent 0 dans la même manche', () => {
    const r = result(session(sc, { rounds: [{ a: 500, b: 500, c: 10 }, { a: 1, b: 1, c: 10 }] }));
    expect(r.winners.sort()).toEqual(['a', 'b']);
    expect(r.tie).toBe(true);
  });
  it('fonctionne en score final uniquement', () => {
    const r = result(session({ ...sc, rounds: false, startScore: 20 }, { finals: { a: 20, b: 15, c: 3 } }));
    expect(r.winners).toEqual(['a']);
    expect(r.reached).toBe(true);
  });
});

describe('score de départ décompté — le dernier en vie gagne', () => {
  const sc = { mode: 'countdown', startScore: 20, countdownWin: 'lastStanding', rounds: true };
  it('le dernier survivant gagne', () => {
    const r = result(session(sc, { rounds: [{ a: 5, b: 20, c: 3 }, { a: 15, c: 4 }] }));
    expect(r.reached).toBe(true);
    expect(r.winners).toEqual(['c']);
    expect(order(r)).toEqual(['c', 'a', 'b']); // a éliminé après b
    expect(r.ranking.find((e) => e.id === 'b').eliminated).toBe(true);
  });
  it('partie en cours : le joueur avec le plus de PV est en tête', () => {
    const r = result(session(sc, { rounds: [{ a: 5, b: 2, c: 20 }] }));
    expect(r.reached).toBe(false);
    expect(r.winners).toEqual(['b']);
    expect(order(r)).toEqual(['b', 'a', 'c']);
  });
  it('égalité si les derniers survivants tombent dans la même manche', () => {
    const r = result(session(sc, { rounds: [{ a: 20 }, { b: 25, c: 21 }] }));
    expect(r.reached).toBe(true);
    expect(r.winners.sort()).toEqual(['b', 'c']);
    expect(r.tie).toBe(true);
    expect(ranks(r).a).toBe(3);
  });
  it('égalité de PV entre survivants', () => {
    const r = result(session(sc, { rounds: [{ a: 5, b: 5, c: 8 }] }));
    expect(r.winners.sort()).toEqual(['a', 'b']);
  });
});

describe('score cible', () => {
  const sc = { mode: 'target', target: 100, rounds: true };
  it('pas de gagnant tant que personne n’a atteint la cible', () => {
    const r = result(session(sc, { rounds: [{ a: 40, b: 60 }] }));
    expect(r.reached).toBe(false);
    expect(r.winners).toEqual(['b']); // meneur provisoire
  });
  it('le premier à atteindre la cible gagne', () => {
    const r = result(session(sc, { rounds: [{ a: 60, b: 90 }, { a: 50, b: 20 }, { a: 0, b: 200 }] }));
    // a et b atteignent 100 à la manche 2 : a=110, b=110 → égalité
    expect(r.winners.sort()).toEqual(['a', 'b']);
    expect(r.tie).toBe(true);
  });
  it('si plusieurs l’atteignent dans la même manche, le plus haut l’emporte', () => {
    const r = result(session(sc, { rounds: [{ a: 60, b: 90, c: 10 }, { a: 40, b: 20 }] }));
    expect(r.reached).toBe(true);
    expect(r.winners).toEqual(['b']);
    expect(order(r)).toEqual(['b', 'a', 'c']);
  });
  it('un joueur qui atteint la cible plus tôt bat un score plus élevé plus tard', () => {
    const r = result(session(sc, { rounds: [{ a: 100, b: 50 }, { a: 0, b: 300 }] }));
    expect(r.winners).toEqual(['a']);
  });
  it('score final uniquement : le plus haut au-dessus de la cible', () => {
    const r = result(session({ ...sc, rounds: false }, { finals: { a: 120, b: 150, c: 80 } }));
    expect(r.winners).toEqual(['b']);
    expect(r.reached).toBe(true);
  });
});

describe('coopératif', () => {
  it('victoire de tout le groupe', () => {
    const s = session({ mode: 'coop' }, { coop: { result: 'win', score: 0 } });
    const r = result(s);
    expect(r.winners).toEqual(['a', 'b', 'c']);
    expect(r.tie).toBe(false);
    expect(r.reached).toBe(true);
    expect(winningPlayerIds(s, r)).toEqual(['a', 'b', 'c']);
  });
  it('défaite de tout le groupe', () => {
    const r = result(session({ mode: 'coop' }, { coop: { result: 'loss', score: 0 } }));
    expect(r.winners).toEqual([]);
    expect(r.reached).toBe(true);
  });
  it('score optionnel', () => {
    expect(result(session({ mode: 'coop', coopScore: true }, { coop: { result: 'win', score: 42 } })).coop.score).toBe(42);
    expect(result(session({ mode: 'coop', coopScore: false }, { coop: { result: 'win', score: 42 } })).coop.score).toBeNull();
  });
  it('non terminé tant que le résultat n’est pas saisi', () => {
    expect(result(session({ mode: 'coop' }, { coop: { result: null } })).reached).toBe(false);
  });
});

describe('par équipes', () => {
  const teamSession = (scoring, data) => ({
    scoring: normalizeScoring({ ...scoring, teams: true }),
    players: [
      { id: 'a', teamId: 't1' }, { id: 'b', teamId: 't1' },
      { id: 'c', teamId: 't2' }, { id: 'd', teamId: 't2' },
    ],
    teams: [{ id: 't1', name: 'Équipe rouge' }, { id: 't2', name: 'Équipe bleue' }],
    rounds: [], finals: {}, ...data,
  });

  it('les scores sont saisis par équipe et les membres gagnants sont désignés', () => {
    const s = teamSession({ mode: 'highest', rounds: true }, { rounds: [{ t1: 80, t2: 82 }, { t1: 90, t2: 70 }] });
    const r = result(s);
    expect(r.winners).toEqual(['t1']);
    expect(winningPlayerIds(s, r)).toEqual(['a', 'b']);
  });
  it('équipes avec score cible', () => {
    const s = teamSession({ mode: 'target', target: 1000, rounds: true }, { rounds: [{ t1: 500, t2: 600 }, { t1: 520, t2: 300 }] });
    const r = result(s);
    expect(r.winners).toEqual(['t1']);
    expect(winningPlayerIds(s, r)).toEqual(['a', 'b']);
  });
  it('égalité entre équipes : tous les membres sont gagnants', () => {
    const s = teamSession({ mode: 'lowest' }, { finals: { t1: 10, t2: 10 } });
    const r = result(s);
    expect(r.tie).toBe(true);
    expect(winningPlayerIds(s, r).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
  it('répartition aléatoire équilibrée', () => {
    const teams = randomTeams(['a', 'b', 'c', 'd', 'e'], 2, () => 0.3);
    expect(teams.map((t) => t.length).sort()).toEqual([2, 3]);
    expect(teams.flat().sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('cas limites', () => {
  it('aucun joueur', () => {
    expect(result(session({}, {}, []))).toEqual({ ranking: [], winners: [], tie: false, reached: false });
  });
  it('tous à zéro : égalité générale', () => {
    const r = result(session({ mode: 'highest' }));
    expect(r.winners).toHaveLength(3);
    expect(r.tie).toBe(true);
  });
});
