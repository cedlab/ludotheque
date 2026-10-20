import { describe, expect, it } from 'vitest';
import { fansOf, gameMatchesFans, migrateLegacyFavorites, toggleFan } from '../src/logic/favorites.js';
import { Store } from '../src/data/store.js';
import { MemoryBackend } from '../src/data/backends.js';

describe('favoris par joueur', () => {
  it('ajoute et retire un fan, ignore les joueurs supprimés', () => {
    let g = { favoriteOf: [] };
    g = { favoriteOf: toggleFan(g, 'a') };
    g = { favoriteOf: toggleFan(g, 'b') };
    expect(fansOf(g)).toEqual(['a', 'b']);
    expect(toggleFan(g, 'a')).toEqual(['b']);
    expect(fansOf(g, [{ id: 'a' }, { id: 'b', deleted: true }])).toEqual(['a']);
    expect(fansOf({})).toEqual([]);
  });

  it('filtre « au moins un » ou « tous »', () => {
    const games = [{ favoriteOf: ['a'] }, { favoriteOf: ['a', 'b'] }, { favoriteOf: ['b'] }, {}];
    expect(games.filter((g) => gameMatchesFans(g, []))).toHaveLength(4);
    expect(games.filter((g) => gameMatchesFans(g, ['a', 'b'], 'any'))).toHaveLength(3);
    expect(games.filter((g) => gameMatchesFans(g, ['a', 'b'], 'all'))).toHaveLength(1);
  });

  it('les anciens cœurs deviennent les favoris d’Aurélie', async () => {
    const store = await new Store(new MemoryBackend()).init();
    const azul = store.save('games', { name: 'Azul', favorite: true });
    store.save('games', { name: 'Uno' });
    expect(migrateLegacyFavorites(store.list('games'), store.list('players'))).toEqual([]); // pas encore de profil
    const aurelie = store.save('players', { name: 'aurelie' });
    store.save('players', { name: 'Cédric' });
    for (const g of migrateLegacyFavorites(store.list('games'), store.list('players'))) store.save('games', g);
    const after = store.get('games', azul.id);
    expect(after.favorite).toBeUndefined();
    expect(after.favoriteOf).toEqual([aurelie.id]);
    expect(store.list('games').filter((g) => fansOf(g).length)).toHaveLength(1);
    expect(migrateLegacyFavorites(store.list('games'), store.list('players'))).toEqual([]); // une seule fois
  });
});
