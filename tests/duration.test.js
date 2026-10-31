import { describe, expect, it } from 'vitest';
import { finishFields, isPaused, pauseFields, pausedTotal, playedMs, reopenFields, resumeFields } from '../src/logic/duration.js';

const MIN = 60000;

describe('durée des parties avec pauses', () => {
  it('déduit les pauses du temps de jeu', () => {
    let s = { startedAt: 0, endedAt: null };
    expect(playedMs(s, 10 * MIN)).toBe(10 * MIN);
    s = { ...s, ...pauseFields(s, 10 * MIN) };
    expect(isPaused(s)).toBe(true);
    expect(playedMs(s, 40 * MIN)).toBe(10 * MIN); // le chrono est arrêté pendant la pause
    s = { ...s, ...resumeFields(s, 40 * MIN) };
    expect(isPaused(s)).toBe(false);
    expect(playedMs(s, 50 * MIN)).toBe(20 * MIN);
    s = { ...s, ...finishFields(s, 55 * MIN) };
    expect(playedMs(s, 999 * MIN)).toBe(25 * MIN);
    expect(pausedTotal(s)).toBe(30 * MIN);
  });

  it('terminer pendant une pause arrête le chrono au début de la pause', () => {
    let s = { startedAt: 0 };
    s = { ...s, ...pauseFields(s, 20 * MIN) };
    s = { ...s, ...finishFields(s, 80 * MIN) };
    expect(playedMs(s)).toBe(20 * MIN);
    expect(s.pausedAt).toBeNull();
  });

  it('une partie rouverte ne compte pas le temps où elle était terminée', () => {
    let s = { startedAt: 0, endedAt: 30 * MIN, status: 'finished' };
    s = { ...s, ...reopenFields(s, 120 * MIN) };
    expect(playedMs(s, 130 * MIN)).toBe(40 * MIN);
  });

  it('les anciennes parties (sans pause) gardent leur durée', () => {
    expect(playedMs({ startedAt: 0, endedAt: 45 * MIN })).toBe(45 * MIN);
  });
});
