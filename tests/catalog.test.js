import { describe, expect, it } from 'vitest';
import { catalogGames, catalogToMerge, normalizeName } from '../src/data/catalog.js';
import { normalizeScoring } from '../src/logic/scoring.js';
import { normalizeDice } from '../src/logic/dice.js';
import { Store } from '../src/data/store.js';
import { MemoryBackend } from '../src/data/backends.js';
import { sampleData } from '../src/data/sample.js';

describe('catalogue des jeux de la maison', () => {
  const games = catalogGames();

  it('fiches valides, identifiants et noms uniques', () => {
    expect(games.length).toBeGreaterThan(40);
    expect(new Set(games.map((g) => g.id)).size).toBe(games.length);
    expect(new Set(games.map((g) => normalizeName(g.name))).size).toBe(games.length);
    for (const g of games) {
      expect(g.minPlayers).toBeLessThanOrEqual(g.maxPlayers);
      expect(g.duration).toBeGreaterThan(0);
      expect(normalizeScoring(g.scoring)).toEqual(g.scoring);
      if (g.dice) expect(normalizeDice(g.dice)).toEqual(g.dice);
    }
  });

  it('n’entre pas en collision avec les données d’exemple', () => {
    const sampleIds = new Set(Object.values(sampleData()).flat().map((r) => r.id));
    expect(games.some((g) => sampleIds.has(g.id))).toBe(false);
  });

  it('normalise les noms', () => {
    expect(normalizeName('Château  Combo')).toBe('chateau combo');
    expect(normalizeName('Les Aventuriers du Rail : Europe')).toBe('les aventuriers du rail europe');
  });

  it('ne double pas un jeu déjà saisi à la main', () => {
    const own = { id: 'perso', name: 'azul', updatedAt: 5, deleted: false };
    const list = catalogToMerge([own]);
    expect(list.some((g) => g.name === 'Azul')).toBe(false);
    expect(list).toHaveLength(games.length - 1);
  });

  it('s’applique sans doublon, et respecte les modifications et suppressions', async () => {
    const store = await new Store(new MemoryBackend()).init();
    const first = store.applyRemote({ games: catalogToMerge(store.list('games', { includeDeleted: true })) });
    expect(first.games.added).toBe(games.length);
    const azul = store.list('games').find((g) => g.name === 'Azul');
    store.save('games', { ...azul, duration: 45 });
    const splendor = store.list('games').find((g) => g.name === 'Splendor');
    store.remove('games', splendor.id);
    const again = store.applyRemote({ games: catalogToMerge(store.list('games', { includeDeleted: true })) });
    expect(again.games).toMatchObject({ added: 0, updated: 0, deleted: 0 });
    expect(store.get('games', azul.id).duration).toBe(45);
    expect(store.get('games', splendor.id)).toBeNull();
  });

  it('les identifiants des premiers jeux sont stables (mise à jour du catalogue)', () => {
    expect(games[0]).toMatchObject({ id: '00000000-0000-4000-8000-000000010001', name: 'Splendor' });
    expect(games[53]).toMatchObject({ id: '00000000-0000-4000-8000-000000010054', name: 'Colorino' });
  });

  it('un téléphone qui avait la version 1 reçoit seulement les nouveaux jeux', async () => {
    const store = await new Store(new MemoryBackend()).init();
    store.applyRemote({ games: games.slice(0, 54) }); // état après la version 1
    const azul = store.list('games').find((g) => g.name === 'Azul');
    store.save('games', { ...azul, notes: 'Notre règle maison' });
    const stats = store.applyRemote({ games: catalogToMerge(store.list('games', { includeDeleted: true })) });
    expect(stats.games).toMatchObject({ added: games.length - 54, updated: 0, deleted: 0 });
    expect(store.get('games', azul.id).notes).toBe('Notre règle maison');
  });

  it('les exemples réutilisent les jeux du catalogue (pas de Skyjo en double)', async () => {
    const { samplesFor } = await import('../src/data/sample.js');
    const store = await new Store(new MemoryBackend()).init();
    store.applyRemote({ games: catalogToMerge([]) });
    store.applyRemote(samplesFor(store.list('games'), normalizeName));
    const names = store.list('games').map((g) => normalizeName(g.name));
    expect(names.filter((n) => n === 'skyjo')).toHaveLength(1);
    expect(names.filter((n) => n === 'uno')).toHaveLength(1);
    const skyjo = store.list('games').find((g) => g.name === 'Skyjo');
    expect(store.list('sessions').filter((s) => s.gameId === skyjo.id)).toHaveLength(1);
    expect(store.list('games')).toHaveLength(games.length + 2); // + Yams et Pandémie
  });
});

