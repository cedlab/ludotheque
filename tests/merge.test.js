import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { applyChanges, formatImportSummary, mergeCollection, mergeDatasets, pickWinner } from '../src/data/merge.js';
import { buildExport, parseImport } from '../src/data/exchange.js';
import { Store } from '../src/data/store.js';
import { IndexedDBBackend, MemoryBackend } from '../src/data/backends.js';
import { sampleData } from '../src/data/sample.js';

const rec = (id, updatedAt, extra = {}) => ({ id, createdAt: 1, updatedAt, deleted: false, ...extra });
const empty = () => ({ games: [], players: [], sessions: [] });

describe('mergeCollection', () => {
  it('ajoute les éléments nouveaux', () => {
    const { changes, stats } = mergeCollection([rec('a', 1)], [rec('b', 1), rec('c', 1)]);
    expect(changes.map((r) => r.id)).toEqual(['b', 'c']);
    expect(stats).toMatchObject({ added: 2, updated: 0, deleted: 0 });
  });

  it('la version la plus récente gagne (dans les deux sens)', () => {
    const local = [rec('a', 10, { name: 'local' }), rec('b', 30, { name: 'local' })];
    const incoming = [rec('a', 20, { name: 'distant' }), rec('b', 20, { name: 'distant' })];
    const { changes, stats } = mergeCollection(local, incoming);
    expect(changes).toEqual([incoming[0]]);
    expect(stats).toMatchObject({ added: 0, updated: 1 });
  });

  it('ne modifie jamais un élément local plus récent', () => {
    const { changes } = mergeCollection([rec('a', 50, { name: 'neuf' })], [rec('a', 5, { name: 'vieux' })]);
    expect(changes).toEqual([]);
  });

  it('propage les suppressions logiques', () => {
    const { changes, stats } = mergeCollection([rec('a', 10)], [rec('a', 20, { deleted: true })]);
    expect(changes[0].deleted).toBe(true);
    expect(stats).toMatchObject({ deleted: 1, added: 0, updated: 0 });
  });

  it('une suppression plus ancienne qu’une modification ne gagne pas', () => {
    const { changes } = mergeCollection([rec('a', 30, { name: 'modifié' })], [rec('a', 20, { deleted: true })]);
    expect(changes).toEqual([]);
  });

  it('enregistre une suppression inconnue localement sans la compter comme ajout', () => {
    const { changes, stats } = mergeCollection([], [rec('x', 5, { deleted: true })]);
    expect(changes).toHaveLength(1);
    expect(stats).toMatchObject({ added: 0, deleted: 0 });
  });

  it('ignore les enregistrements invalides', () => {
    const { changes, stats } = mergeCollection([], [{ name: 'sans id' }, { id: 'a' }, null, rec('ok', 1)]);
    expect(changes.map((r) => r.id)).toEqual(['ok']);
    expect(stats.ignored).toBe(3);
  });

  it('dates égales et contenus différents : départage déterministe et symétrique', () => {
    const x = rec('a', 10, { name: 'X' });
    const y = rec('a', 10, { name: 'Y' });
    expect(pickWinner(x, y)).toBe(pickWinner(y, x));
  });

  it('dédoublonne un même id présent plusieurs fois dans le fichier', () => {
    const { changes, stats } = mergeCollection([], [rec('a', 1, { v: 1 }), rec('a', 3, { v: 3 }), rec('a', 2, { v: 2 })]);
    expect(changes).toHaveLength(1);
    expect(changes[0].v).toBe(3);
    expect(stats.added).toBe(1);
  });
});

describe('mergeDatasets', () => {
  it('importer deux fois le même fichier ne crée aucun doublon', () => {
    const local = { games: [rec('g1', 1)], players: [], sessions: [] };
    const file = { games: [rec('g1', 1), rec('g2', 1)], players: [rec('p1', 1)], sessions: [rec('s1', 1)] };
    const first = mergeDatasets(local, file);
    const after1 = applyChanges(local, first.changes);
    expect(after1.games).toHaveLength(2);

    const second = mergeDatasets(after1, file);
    expect(second.changes).toEqual({ games: [], players: [], sessions: [] });
    expect(formatImportSummary(second.stats)).toBe('Rien de nouveau : votre ludothèque était déjà à jour.');
    expect(applyChanges(after1, second.changes)).toEqual(after1);
  });

  it('la fusion est commutative : deux téléphones convergent', () => {
    const phoneA = {
      games: [rec('g1', 10, { name: 'A' }), rec('g2', 5)],
      players: [rec('p1', 1)],
      sessions: [rec('s1', 1), rec('s2', 9, { deleted: true })],
    };
    const phoneB = {
      games: [rec('g1', 20, { name: 'B' }), rec('g3', 2)],
      players: [rec('p1', 1), rec('p2', 3)],
      sessions: [rec('s2', 4)],
    };
    const aAfter = applyChanges(phoneA, mergeDatasets(phoneA, phoneB).changes);
    const bAfter = applyChanges(phoneB, mergeDatasets(phoneB, phoneA).changes);
    const norm = (d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, [...v].sort((x, y) => x.id.localeCompare(y.id))]));
    expect(norm(aAfter)).toEqual(norm(bAfter));
    expect(aAfter.games.find((g) => g.id === 'g1').name).toBe('B');
    expect(aAfter.sessions.find((s) => s.id === 's2').deleted).toBe(true);
  });
});

describe('formatImportSummary', () => {
  const st = (added = 0, updated = 0, deleted = 0) => ({ added, updated, deleted });
  it('exemple du cahier des charges', () => {
    expect(formatImportSummary({ sessions: st(3), games: st(1), players: st() })).toBe('3 parties et 1 jeu ajoutés');
  });
  it('accords au singulier et au féminin', () => {
    expect(formatImportSummary({ sessions: st(1), games: st(), players: st() })).toBe('1 partie ajoutée');
    expect(formatImportSummary({ sessions: st(2), games: st(), players: st() })).toBe('2 parties ajoutées');
    expect(formatImportSummary({ sessions: st(), games: st(1), players: st() })).toBe('1 jeu ajouté');
  });
  it('mises à jour et suppressions', () => {
    expect(formatImportSummary({ sessions: st(0, 0, 1), games: st(0, 2), players: st(1, 1) }))
      .toBe('1 joueur ajouté · 2 jeux et 1 joueur mis à jour · 1 partie supprimée');
    expect(formatImportSummary({ sessions: st(0, 2), games: st(), players: st() })).toBe('2 parties mises à jour');
  });
  it('trois catégories', () => {
    expect(formatImportSummary({ sessions: st(2), games: st(1), players: st(3) })).toBe('2 parties, 1 jeu et 3 joueurs ajoutés');
  });
});

describe('fichier d’échange', () => {
  it('aller-retour export → import', () => {
    const data = { games: [rec('g', 1, { logo: 'data:image/jpeg;base64,AAAA' })], players: [rec('p', 2)], sessions: [rec('s', 3, { deleted: true })] };
    const parsed = parseImport(JSON.stringify(buildExport(data, 123)));
    expect(parsed).toEqual(data); // logos et suppressions inclus
  });
  it('refuse les fichiers étrangers', () => {
    expect(() => parseImport('pas du json')).toThrow(/JSON invalide/);
    expect(() => parseImport('{"foo":1}')).toThrow(/ne provient pas/);
    expect(() => parseImport('{"app":"ludotheque","version":99}')).toThrow(/plus récente/);
  });
});

describe('Store (fusion + persistance)', () => {
  it('import : ajout, mise à jour, suppression, puis réimport sans doublon', async () => {
    const store = await new Store(new MemoryBackend()).init();
    const game = store.save('games', { name: 'Skyjo' });
    const player = store.save('players', { name: 'Alex' });

    // Un autre téléphone : il a reçu nos données, puis modifié/supprimé/ajouté.
    const other = await new Store(new MemoryBackend()).init();
    other.importText(JSON.stringify(store.exportData()));
    await new Promise((r) => setTimeout(r, 2));
    other.save('games', { ...other.get('games', game.id), name: 'Skyjo (édition)' });
    other.remove('players', player.id);
    other.save('sessions', { gameId: game.id, status: 'finished' });
    other.save('sessions', { gameId: game.id, status: 'finished' });
    other.save('games', { name: 'Uno' });

    const file = JSON.stringify(other.exportData());
    const stats = store.importText(file);
    expect(formatImportSummary(stats)).toBe('2 parties et 1 jeu ajoutés · 1 jeu mis à jour · 1 joueur supprimé');
    expect(store.get('games', game.id).name).toBe('Skyjo (édition)');
    expect(store.get('players', player.id)).toBeNull();
    expect(store.get('players', player.id, { includeDeleted: true }).deleted).toBe(true);
    expect(store.list('sessions')).toHaveLength(2);

    const again = store.importText(file);
    expect(formatImportSummary(again)).toMatch(/Rien de nouveau/);
    expect(store.list('sessions')).toHaveLength(2);
    expect(store.list('games')).toHaveLength(2);
  });

  it('une modification locale postérieure à l’export n’est pas écrasée par l’import', async () => {
    const store = await new Store(new MemoryBackend()).init();
    const g = store.save('games', { name: 'Original' });
    const file = JSON.stringify(store.exportData());
    store.save('games', { ...g, name: 'Renommé ensuite' });
    store.importText(file);
    expect(store.get('games', g.id).name).toBe('Renommé ensuite');
  });

  it('persiste dans IndexedDB et recharge', async () => {
    const backend = new IndexedDBBackend(indexedDB, 'test-db');
    const store = await new Store(backend).init();
    store.applyRemote(sampleData());
    await store.flush();
    const reloaded = await new Store(new IndexedDBBackend(indexedDB, 'test-db')).init();
    expect(reloaded.list('games')).toHaveLength(4);
    expect(reloaded.list('players')).toHaveLength(3);
    expect(reloaded.list('sessions')).toHaveLength(4);
  });

  it('les données d’exemple chargées deux fois ne créent pas de doublon', async () => {
    const store = await new Store(new MemoryBackend()).init();
    expect(formatImportSummary(store.applyRemote(sampleData()))).toBe('4 parties, 4 jeux et 3 joueurs ajoutés');
    expect(formatImportSummary(store.applyRemote(sampleData()))).toMatch(/Rien de nouveau/);
    expect(store.list('games')).toHaveLength(4);
  });

  it('notifie les modifications locales (point d’accroche pour une synchro en ligne)', async () => {
    const store = await new Store(new MemoryBackend()).init();
    const seen = [];
    store.onLocalChange((col, recs) => seen.push([col, recs.length]));
    store.save('players', { name: 'Sam' });
    store.applyRemote({ ...empty(), games: [rec('g', 1)] }); // distant : pas renvoyé
    expect(seen).toEqual([['players', 1]]);
  });

  it('joueur supprimé par erreur : l’import le signale, la corbeille le restaure partout', async () => {
    const wife = await new Store(new MemoryBackend()).init();
    const maxou = wife.save('players', { name: 'Maxou' });
    const file = JSON.stringify(wife.exportData());

    const me = await new Store(new MemoryBackend()).init();
    me.importText(file);
    await new Promise((r) => setTimeout(r, 2));
    me.remove('players', maxou.id); // suppression par erreur

    const again = me.importText(file);
    expect(me.get('players', maxou.id)).toBeNull(); // la suppression, plus récente, l’emporte
    expect(formatImportSummary(again)).toBe('1 joueur resté supprimé (Plus → Corbeille pour restaurer)');

    me.restore('players', maxou.id);
    expect(me.get('players', maxou.id).name).toBe('Maxou');
    expect(formatImportSummary(me.importText(file))).toMatch(/Rien de nouveau/);

    // Propagation : un troisième téléphone qui avait reçu la suppression récupère Maxou.
    const other = await new Store(new MemoryBackend()).init();
    other.importText(file);
    other.applyRemote({ players: [{ ...maxou, deleted: true, updatedAt: maxou.updatedAt + 1 }] }); // reçoit la suppression
    expect(other.get('players', maxou.id)).toBeNull();
    expect(formatImportSummary(other.importText(JSON.stringify(me.exportData())))).toBe('1 joueur mis à jour');
    expect(other.get('players', maxou.id).name).toBe('Maxou');
  });

  it('vider la corbeille : l’élément ne revient pas à l’import, et la suppression se propage', async () => {
    const a = await new Store(new MemoryBackend()).init();
    const p = a.save('players', { name: 'Test', color: '#000' });
    const file = JSON.stringify(a.exportData());
    await new Promise((r) => setTimeout(r, 2));
    a.remove('players', p.id);
    expect(a.purge('players', [p.id])).toBe(1);
    const t = a.get('players', p.id, { includeDeleted: true });
    expect(t).toMatchObject({ deleted: true, purged: true });
    expect(t.name).toBeUndefined();
    expect(formatImportSummary(a.importText(file))).toMatch(/Rien de nouveau/); // pas de message « Corbeille »
    expect(a.get('players', p.id)).toBeNull();
    // un autre téléphone qui avait le joueur le perd au prochain partage
    const b = await new Store(new MemoryBackend()).init();
    b.importText(file);
    expect(formatImportSummary(b.importText(JSON.stringify(a.exportData())))).toBe('1 joueur supprimé');
    expect(a.purge('players', [p.id])).toBe(0);
  });
});

