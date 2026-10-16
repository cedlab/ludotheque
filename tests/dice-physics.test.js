import { describe, expect, it } from 'vitest';
import { DiceTable } from '../src/logic/dice-physics.js';

// Générateur pseudo-aléatoire reproductible
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function simulate(table, maxSeconds = 6) {
  const frames = [];
  let t = 0;
  let res;
  do {
    res = table.step(1 / 60);
    frames.push(res);
    t += 1 / 60;
  } while (!res.done && t < maxSeconds);
  return { frames, time: t, done: res.done };
}

describe('simulation du tapis de dés', () => {
  for (const count of [1, 5, 12]) {
    it(`${count} dé(s) : s'arrêtent, restent sur le tapis, sans se chevaucher`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        const table = new DiceTable({ width: 340, height: 280, size: count > 8 ? 54 : 64, random: seeded(seed) });
        table.layout(count);
        const finals = Array.from({ length: count }, (_, i) => (i % 6) + 1);
        table.throw(finals);
        const { done, time, frames } = simulate(table);
        expect(done).toBe(true);
        expect(time).toBeLessThan(3.5);
        const r = table.radius;
        for (const d of table.dice) {
          expect(d.x).toBeGreaterThanOrEqual(r - 0.01);
          expect(d.x).toBeLessThanOrEqual(340 - r + 0.01);
          expect(d.y).toBeGreaterThanOrEqual(r - 0.01);
          expect(d.y).toBeLessThanOrEqual(280 - r + 0.01);
        }
        expect(table.dice.map((d) => d.value)).toEqual(finals);
        for (let i = 0; i < count; i++) {
          for (let j = i + 1; j < count; j++) {
            const a = table.dice[i];
            const b = table.dice[j];
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(2 * r - 3);
          }
        }
        // Des chocs ont eu lieu et les faces ont défilé
        expect(frames.some((f) => f.impacts.length > 0)).toBe(true);
        expect(frames.filter((f) => f.changed).length).toBeGreaterThan(3);
      }
    });
  }

  it('les faces défilent de plus en plus lentement', () => {
    const table = new DiceTable({ width: 340, height: 280, random: seeded(7) });
    table.layout(1);
    table.throw([4]);
    const changes = [];
    let t = 0;
    let res;
    do {
      res = table.step(1 / 60);
      t += 1 / 60;
      if (res.changed) changes.push(t);
    } while (!res.done && t < 6);
    const half = t / 2;
    const early = changes.filter((c) => c < half).length;
    const late = changes.filter((c) => c >= half).length;
    expect(early).toBeGreaterThan(late);
  });

  it('les dés gardés ne bougent pas et gardent leur valeur', () => {
    const table = new DiceTable({ width: 340, height: 280, random: seeded(3) });
    table.layout(5);
    table.throw([1, 2, 3, 4, 5]);
    simulate(table);
    const before = table.dice.map((d) => ({ x: d.x, y: d.y, value: d.value }));
    table.throw([6, 6, 6, 6, 6], new Set([1, 3]));
    simulate(table);
    for (const i of [1, 3]) {
      expect(table.dice[i].x).toBeCloseTo(before[i].x, 5);
      expect(table.dice[i].y).toBeCloseTo(before[i].y, 5);
      expect(table.dice[i].value).toBe(before[i].value);
    }
    expect([0, 2, 4].map((i) => table.dice[i].value)).toEqual([6, 6, 6]);
  });

  it('finish() conclut immédiatement sur les valeurs finales', () => {
    const table = new DiceTable({ random: seeded(9) });
    table.layout(3);
    table.throw([2, 4, 6]);
    table.step(1 / 60);
    table.finish();
    expect(table.rolling).toBe(false);
    expect(table.dice.map((d) => d.value)).toEqual([2, 4, 6]);
  });
});

describe('pose des dés', () => {
  it('les dés à chiffres se posent à l’endroit, les D6 sur un côté', () => {
    for (const faces of [6, 20]) {
      const table = new DiceTable({ width: 340, height: 280, faces, random: seeded(11) });
      table.layout(6, faces);
      table.throw([1, 2, 3, 4, 5, 6]);
      let res;
      do res = table.step(1 / 60); while (!res.done);
      for (const d of table.dice) {
        const mod = faces === 6 ? 90 : 360;
        const off = ((d.angle % mod) + mod) % mod;
        expect(Math.min(off, mod - off)).toBeLessThanOrEqual(8.01);
      }
    }
  });
});
