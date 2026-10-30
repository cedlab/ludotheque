import { describe, expect, it } from 'vitest';
import { catalogGames, catalogToMerge, normalizeName, publishersToFill } from '../src/data/catalog.js';
import { normalizeScoring } from '../src/logic/scoring.js';
import { normalizeDice } from '../src/logic/dice.js';
import { Store } from '../src/data/store.js';
import { MemoryBackend } from '../src/data/backends.js';
import { gameList, listById, normalizeList } from '../src/logic/collection.js';
import { ageLabel, ageOptions, gameMatchesAges } from '../src/logic/ages.js';
import { sampleData } from '../src/data/sample.js';

describe('catalogue des jeux de la maison', () => {
  const games = catalogGames();
  const active = games.filter((g) => !g.deleted);

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

  it('une mise à jour du catalogue garde les favoris et la liste choisie', () => {
    const g = active[0];
    const mine = { ...g, favorite: true, status: 'wishlist', updatedAt: g.updatedAt - 1000 };
    const merged = catalogToMerge([mine]).find((x) => x.id === g.id);
    expect(merged.favorite).toBe(true);
    expect(merged.status).toBe('wishlist');
    expect(catalogToMerge([]).find((x) => x.id === g.id).favorite).toBeUndefined();
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
    expect(first.games.added).toBe(active.length);
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
    // État après la version 1 : les 54 premiers jeux, tous présents
    store.applyRemote({ games: games.slice(0, 54).map((g) => ({ ...g, deleted: false, updatedAt: Date.UTC(2024, 0, 1) })) });
    const azul = store.list('games').find((g) => g.name === 'Azul');
    store.save('games', { ...azul, notes: 'Notre règle maison' });
    const stats = store.applyRemote({ games: catalogToMerge(store.list('games', { includeDeleted: true })) });
    const removedInV1 = games.slice(0, 54).filter((g) => g.deleted).length;
    expect(stats.games).toMatchObject({ added: active.length - (54 - removedInV1), deleted: removedInV1 });
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
    expect(store.list('games')).toHaveLength(active.length + 2); // + Yams et Pandémie
  });

  it('chaque jeu du catalogue a une vignette', () => {
    for (const g of active) expect(g.icon, g.name).toBeTruthy();
  });

  it('mise à jour v2 → v3 : les vignettes arrivent, les jeux modifiés sont respectés', async () => {
    const store = await new Store(new MemoryBackend()).init();
    // État d'un téléphone en version 2 : mêmes jeux, sans vignette, plus anciens
    const old = active.map(({ icon, ...g }) => ({ ...g, updatedAt: Date.UTC(2024, 0, 1) }));
    store.applyRemote({ games: old });
    const azul = store.list('games').find((g) => g.name === 'Azul');
    store.save('games', { ...azul, notes: 'Modifié sur le téléphone' });
    const stats = store.applyRemote({ games: catalogToMerge(store.list('games', { includeDeleted: true })) });
    expect(stats.games).toMatchObject({ added: 0, updated: active.length - 1 });
    expect(store.list('games').find((g) => g.name === 'Splendor').icon).toBe('💎');
    expect(store.get('games', azul.id).icon).toBeUndefined();
    expect(store.get('games', azul.id).notes).toBe('Modifié sur le téléphone');
  });

  it('mise à jour v3 → v4 : les jeux retirés disparaissent, sauf s’ils ont été modifiés depuis', async () => {
    const store = await new Store(new MemoryBackend()).init();
    const v3 = games.map((g) => ({ ...g, deleted: false, updatedAt: Date.UTC(2024, 1, 1) }));
    store.applyRemote({ games: v3 });
    const colorino = store.list('games').find((g) => g.name === 'Colorino');
    const loto = store.list('games').find((g) => g.name === 'Loto des p’tits incollables');
    store.save('games', { ...loto, notes: 'On le garde !' });
    const stats = store.applyRemote({ games: catalogToMerge(store.list('games', { includeDeleted: true })) });
    expect(stats.games.deleted).toBe(games.length - active.length - 1);
    expect(store.get('games', colorino.id)).toBeNull();
    expect(store.get('games', loto.id).notes).toBe('On le garde !');
    expect(store.list('games')).toHaveLength(active.length + 1);
  });

  it('les jeux retirés ne s’installent pas sur un nouveau téléphone', async () => {
    const store = await new Store(new MemoryBackend()).init();
    store.applyRemote({ games: catalogToMerge([]) });
    expect(store.list('games').map((g) => g.name)).not.toContain('Colorino');
    expect(store.list('games')).toHaveLength(active.length);
    expect(active).toHaveLength(games.length - 14); // 14 jeux retirés (REMOVED)
  });

  it('mise à jour depuis v5 : seuls les nouveaux jeux arrivent', async () => {
    const store = await new Store(new MemoryBackend()).init();
    store.applyRemote({ games: games.slice(0, 90) }); // catalogue v5
    const stats = store.applyRemote({ games: catalogToMerge(store.list('games', { includeDeleted: true })) });
    expect(stats.games).toMatchObject({ added: games.length - 90, updated: 0, deleted: 0 });
    expect(store.list('games').find((g) => g.name === 'Perudo').dice).toEqual({ count: 5, faces: 6 });
  });

  it('mise à jour v7 → v8 : les Osmooz sont retirés, rien d’autre ne bouge', async () => {
    const store = await new Store(new MemoryBackend()).init();
    // téléphone en v7 : Osmooz présents, 12 jeux déjà retirés
    const v7 = games.map((g) => (g.name.startsWith('Osmooz') ? { ...g, deleted: false, updatedAt: Date.UTC(2024, 3, 1) } : g.deleted ? { ...g, updatedAt: Date.UTC(2024, 2, 1) } : g));
    store.applyRemote({ games: v7 });
    const stats = store.applyRemote({ games: catalogToMerge(store.list('games', { includeDeleted: true })) });
    expect(stats.games).toMatchObject({ added: 0, deleted: 2 });
    expect(store.list('games').some((g) => g.name.startsWith('Osmooz'))).toBe(false);
  });
});


describe('listes de jeux', () => {
  it('à la maison par défaut, testé ou à acquérir sinon', () => {
    expect(gameList({})).toBe('owned');
    expect(gameList({ status: 'bidon' })).toBe('owned');
    expect(gameList({ status: 'tested' })).toBe('tested');
    expect(gameList({ status: 'totest' })).toBe('totest');
    expect(gameList({ status: 'wishlist' })).toBe('wishlist');
    expect(normalizeList(undefined)).toBe('owned');
    expect(listById('wishlist').label).toBe('À acquérir');
  });
});

describe('filtre par âge', () => {
  const games = [{ minAge: 8 }, { minAge: 6 }, { minAge: 8 }, {}, { minAge: 12 }];
  it('propose les âges présents et accepte plusieurs choix', () => {
    expect(ageOptions(games)).toEqual([0, 6, 8, 12]);
    expect(games.filter((g) => gameMatchesAges(g, []))).toHaveLength(5);
    expect(games.filter((g) => gameMatchesAges(g, [6, 12]))).toHaveLength(2);
    expect(games.filter((g) => gameMatchesAges(g, [0]))).toHaveLength(1);
    expect(ageLabel(8)).toBe('Dès 8 ans');
  });
});

describe('avis sur un jeu', () => {
  it('note bornée, commentaire nettoyé, avis vide = null', async () => {
    const { normalizeReview, stars } = await import('../src/logic/review.js');
    expect(normalizeReview({ rating: 4, comment: '  Super à 4  ', at: 5 })).toEqual({ rating: 4, comment: 'Super à 4', at: 5 });
    expect(normalizeReview({ rating: 9 }).rating).toBe(5);
    expect(normalizeReview({ rating: 0, comment: '   ' })).toBeNull();
    expect(normalizeReview(null)).toBeNull();
    expect(stars(3)).toBe('★★★☆☆');
  });
});

describe('éditeurs', () => {
  it('complète l’éditeur sans toucher au reste de la fiche', () => {
    const loco = catalogGames().find((g) => g.name === 'Loco Circus');
    expect(loco.publisher).toBe('Smart Games');
    const mine = { ...loco, publisher: '', notes: 'Nos notes', updatedAt: Date.now() };
    const handMade = { id: 'perso', name: 'azul', publisher: '', deleted: false };
    const already = { id: 'x', name: 'Uno', publisher: 'Autre', deleted: false };
    const out = publishersToFill([mine, handMade, already]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ publisher: 'Smart Games', notes: 'Nos notes' });
    expect(out[1]).toMatchObject({ id: 'perso', publisher: 'Plan B Games' });
  });
});
