import { describe, expect, it } from 'vitest';
import { computeStats, filterHistory } from '../src/logic/stats.js';
import { PickerEngine } from '../src/logic/picker-engine.js';
import { sampleData } from '../src/data/sample.js';

describe('statistiques', () => {
  const data = sampleData();
  const [alex, sam, charlie] = data.players.map((p) => p.id);
  const stats = computeStats(data);

  it('compte les parties et victoires', () => {
    expect(stats.totalSessions).toBe(4);
    // Skyjo : Sam (33) ; Yams : Sam (254) ; Uno : Alex (540, cible 500) ; Pandémie : victoire coop
    expect(stats.players[sam]).toMatchObject({ played: 3, wins: 2, coopPlayed: 1, coopWins: 1 });
    expect(stats.players[alex]).toMatchObject({ played: 3, wins: 1 });
    expect(stats.players[charlie]).toMatchObject({ played: 2, wins: 0 });
  });

  it('séries de victoires', () => {
    // Sam : gagne Skyjo, Yams, perd Uno, gagne Pandémie → meilleure série 2, en cours 1
    expect(stats.players[sam]).toMatchObject({ bestStreak: 2, currentStreak: 1 });
    // Alex : perd, perd, gagne Uno, gagne Pandémie
    expect(stats.players[alex]).toMatchObject({ bestStreak: 2, currentStreak: 2 });
  });

  it('meilleur score par jeu selon le type de victoire', () => {
    const byName = Object.fromEntries(stats.bestScores.map((b) => [b.name, b]));
    expect(byName.Skyjo).toMatchObject({ value: 33, holders: ['Sam'] }); // le plus bas
    expect(byName.Yams).toMatchObject({ value: 254, holders: ['Sam'] });
    expect(byName.Uno).toMatchObject({ value: 540, holders: ['Alex'] });
    expect(byName['Pandémie']).toBeUndefined(); // coop sans score
  });

  it('jeux les plus joués et historique filtré', () => {
    expect(stats.games).toHaveLength(4);
    expect(filterHistory(data.sessions, { playerId: charlie })).toHaveLength(3);
    expect(filterHistory(data.sessions, { gameId: data.games[0].id })).toHaveLength(1);
    const hist = filterHistory(data.sessions);
    expect(hist[0].gameName).toBe('Pandémie'); // plus récent d'abord
  });

  it('ignore les parties supprimées ou en cours', () => {
    const d = sampleData();
    d.sessions[0].deleted = true;
    d.sessions[1].status = 'playing';
    expect(computeStats(d).totalSessions).toBe(2);
  });
});

describe('moteur du tirage au doigt', () => {
  const engine = (opts) => new PickerEngine({ settleMs: 1000, countdownMs: 1500, random: () => 0.5, ...opts });
  const run = (e, from, to) => {
    for (let t = from; t <= to; t += 50) e.tick(t);
  };

  it('désigne un doigt parmi 5 posés simultanément', () => {
    const e = engine();
    for (let i = 0; i < 5; i++) e.down(i, 50 + i * 60, 300, 0);
    expect(new Set(e.activeTouches.map((t) => t.color)).size).toBe(5);
    expect(e.phase).toBe('settling');
    run(e, 0, 1000);
    expect(e.phase).toBe('countdown');
    expect(e.countdownNumber(1000)).toBe(3);
    run(e, 1000, 2500);
    expect(e.phase).toBe('result');
    expect([0, 1, 2, 3, 4]).toContain(e.result.winnerId);
    expect(e.result.order.sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('gère 10 doigts', () => {
    const e = engine();
    for (let i = 0; i < 10; i++) e.down(i, i * 30, i * 40, 0);
    run(e, 0, 3000);
    expect(e.result.order).toHaveLength(10);
  });

  it('attend au moins 2 doigts', () => {
    const e = engine();
    e.down(1, 10, 10, 0);
    run(e, 0, 5000);
    expect(e.phase).toBe('idle');
  });

  it('recommence si un doigt est ajouté ou levé pendant le compte à rebours', () => {
    const e = engine();
    e.down(1, 10, 10, 0);
    e.down(2, 200, 10, 0);
    run(e, 0, 1200);
    expect(e.phase).toBe('countdown');
    e.down(3, 100, 300, 1200);
    expect(e.phase).toBe('settling');
    run(e, 1200, 2300);
    expect(e.phase).toBe('countdown');
    e.up(3, 2300);
    expect(e.phase).toBe('settling');
    expect(e.result).toBeNull();
  });

  it('recommence si un doigt se déplace nettement, pas pour un tremblement', () => {
    const e = engine();
    e.down(1, 10, 10, 0);
    e.down(2, 200, 10, 0);
    run(e, 0, 1100);
    e.move(1, 15, 14, 1100); // tremblement
    expect(e.phase).toBe('countdown');
    e.move(1, 120, 140, 1150);
    expect(e.phase).toBe('settling');
  });

  it('le résultat reste affiché jusqu’à ce que tous les doigts soient levés', () => {
    const e = engine();
    e.down(1, 10, 10, 0);
    e.down(2, 200, 10, 0);
    run(e, 0, 3000);
    expect(e.phase).toBe('result');
    e.up(1, 3100);
    e.down(3, 50, 50, 3150); // ignoré : un doigt est encore posé
    expect(e.phase).toBe('result');
    e.up(2, 3200);
    e.down(4, 50, 50, 3300); // nouveau tirage
    expect(e.phase).toBe('idle');
    expect(e.touches.size).toBe(1);
  });

  it('forme des équipes équilibrées', () => {
    const e = engine({ mode: 'teams', teamCount: 3 });
    for (let i = 0; i < 7; i++) e.down(i, i * 40, 100, 0);
    run(e, 0, 3000);
    const counts = [0, 0, 0];
    Object.values(e.result.teams).forEach((t) => counts[t]++);
    expect(counts.sort()).toEqual([2, 2, 3]);
  });

  it('il faut au moins autant de doigts que d’équipes', () => {
    const e = engine({ mode: 'teams', teamCount: 3 });
    e.down(1, 0, 0, 0);
    e.down(2, 100, 0, 0);
    run(e, 0, 5000);
    expect(e.phase).toBe('idle');
  });
});
