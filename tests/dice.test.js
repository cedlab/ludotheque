import { describe, expect, it } from 'vitest';
import { describeDice, normalizeDice, rollDice, rollDie, sumDice } from '../src/logic/dice.js';

describe('dés', () => {
  it('lance le bon nombre de dés, dans les bornes', () => {
    for (const faces of [4, 6, 20, 100]) {
      const v = rollDice(12, faces);
      expect(v).toHaveLength(12);
      expect(v.every((x) => Number.isInteger(x) && x >= 1 && x <= faces)).toBe(true);
    }
  });

  it('couvre toutes les faces de façon équilibrée', () => {
    const counts = Array(7).fill(0);
    for (let i = 0; i < 60000; i++) counts[rollDie(6)]++;
    for (let f = 1; f <= 6; f++) expect(counts[f]).toBeGreaterThan(9000);
    expect(counts[0]).toBe(0);
  });

  it('valeurs extrêmes du générateur', () => {
    expect(rollDie(6, () => 0)).toBe(1);
    expect(rollDie(6, () => 0.999999)).toBe(6);
  });

  it('garde les dés bloqués', () => {
    const v = rollDice(5, 6, { random: () => 0, held: [1, 3], previous: [6, 5, 4, 3, 2] });
    expect(v).toEqual([1, 5, 1, 3, 1]);
  });

  it('total et description', () => {
    expect(sumDice([3, 4, 6])).toBe(13);
    expect(describeDice({ count: 5, faces: 6 })).toBe('5 × D6');
  });

  it('normalise une configuration', () => {
    expect(normalizeDice({ count: 40, faces: 7 })).toEqual({ count: 12, faces: 6 });
    expect(normalizeDice({ count: 0, faces: '20' })).toEqual({ count: 1, faces: 20 });
    expect(normalizeDice(null)).toBeNull();
  });
});
