import { describe, expect, it } from 'vitest';
import { GAME_STYLES, gameHasStyle, gameStyles, normalizeStyles } from '../src/logic/styles.js';
import { catalogGames, catalogToMerge } from '../src/data/catalog.js';
import { Store } from '../src/data/store.js';
import { MemoryBackend } from '../src/data/backends.js';

describe('styles de jeu', () => {
  it('normalise (ordre fixe, valeurs inconnues ignorées)', () => {
    expect(normalizeStyles(['cartes', 'inconnu', 'strategie', 'cartes'])).toEqual(['strategie', 'cartes']);
    expect(normalizeStyles(null)).toEqual([]);
  });

  it('un jeu au comptage coopératif est toujours « Coopératif »', () => {
    const g = { styles: ['cartes'], scoring: { mode: 'coop' } };
    expect(gameStyles(g)).toEqual(['cartes', 'coop']);
    expect(gameHasStyle(g, 'coop')).toBe(true);
  });

  it('filtre', () => {
    const g = { styles: ['strategie', 'famille'], scoring: { mode: 'highest' } };
    expect(gameHasStyle(g, 'famille')).toBe(true);
    expect(gameHasStyle(g, 'ambiance')).toBe(false);
    expect(gameHasStyle(g, null)).toBe(true);
  });

  it('chaque jeu de la maison a au moins un style valide', () => {
    const ids = new Set(GAME_STYLES.map((s) => s.id));
    for (const g of catalogGames()) {
      expect(g.styles.length, g.name).toBeGreaterThan(0);
      for (const s of g.styles) expect(ids.has(s), `${g.name} : ${s}`).toBe(true);
    }
  });

  it('mise à jour v4 → v5 : les styles arrivent sur les jeux non modifiés', async () => {
    const store = await new Store(new MemoryBackend()).init();
    const v4 = catalogGames().map(({ styles, ...g }) => ({ ...g, updatedAt: g.deleted ? g.updatedAt : Date.UTC(2024, 1, 1) }));
    store.applyRemote({ games: v4 });
    const azul = store.list('games').find((g) => g.name === 'Azul');
    store.save('games', { ...azul, duration: 50 });
    const stats = store.applyRemote({ games: catalogToMerge(store.list('games', { includeDeleted: true })) });
    const active = catalogGames().filter((g) => !g.deleted).length;
    expect(stats.games).toMatchObject({ added: 0, deleted: 0, updated: active - 1 });
    expect(store.list('games').find((g) => g.name === 'Splendor').styles).toEqual(['strategie', 'cartes', 'famille']);
    expect(store.get('games', azul.id).duration).toBe(50);
  });
});

describe('filtre multi-styles', () => {
  it('au moins un / tous', async () => {
    const { gameMatchesStyles } = await import('../src/logic/styles.js');
    const g = { styles: ['cartes', 'famille'], scoring: { mode: 'highest' } };
    expect(gameMatchesStyles(g, [])).toBe(true);
    expect(gameMatchesStyles(g, ['cartes', 'ambiance'])).toBe(true);
    expect(gameMatchesStyles(g, ['cartes', 'ambiance'], 'all')).toBe(false);
    expect(gameMatchesStyles(g, ['cartes', 'famille'], 'all')).toBe(true);
    expect(gameMatchesStyles(g, ['ambiance', 'des'])).toBe(false);
  });
});
