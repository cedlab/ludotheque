import { describe, expect, it, vi } from 'vitest';
import { Store } from '../src/data/store.js';
import { MemoryBackend } from '../src/data/backends.js';
import { SyncEngine, formatFamilyCode, generateFamilyCode, normalizeFamilyCode } from '../src/sync/engine.js';

/** Faux serveur partagé (comme Firestore : chaque abonné reçoit les changements). */
class FakeServer {
  constructor() {
    this.docs = new Map();
    this.subs = new Set();
    this.online = true;
  }
  remote() {
    const server = this;
    return {
      subscribe(onRecords) {
        const sub = { onRecords };
        server.subs.add(sub);
        queueMicrotask(() => onRecords([...server.docs.values()].map((d) => structuredClone(d)), { initial: true }));
        return () => server.subs.delete(sub);
      },
      async write(items) {
        if (!server.online) throw new Error('hors ligne');
        for (const it of items) server.docs.set(`${it.col}/${it.record.id}`, structuredClone(it));
        for (const s of server.subs) s.onRecords(structuredClone(items), { initial: false });
      },
    };
  }
}

const settle = async () => {
  for (let i = 0; i < 6; i++) {
    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();
  }
};

async function phone(server) {
  const store = await new Store(new MemoryBackend()).init();
  const engine = new SyncEngine(store, server.remote(), { debounceMs: 10 }).start();
  return { store, engine };
}

describe('synchronisation en ligne', () => {
  it('deux téléphones fusionnent puis restent synchronisés', async () => {
    vi.useFakeTimers();
    const server = new FakeServer();
    // Téléphone A a déjà des données avant d'activer la synchro
    const a = await phone(server);
    const alex = a.store.save('players', { name: 'Alex' });
    await settle();
    // Téléphone B a ses propres données
    const bStore = await new Store(new MemoryBackend()).init();
    bStore.save('players', { name: 'Sam' });
    const b = { store: bStore, engine: new SyncEngine(bStore, server.remote(), { debounceMs: 10 }).start() };
    await settle();
    expect(a.store.list('players').map((p) => p.name).sort()).toEqual(['Alex', 'Sam']);
    expect(b.store.list('players').map((p) => p.name).sort()).toEqual(['Alex', 'Sam']);

    // Modification et suppression se propagent
    b.store.save('players', { ...b.store.get('players', alex.id), name: 'Alexandre' });
    await settle();
    expect(a.store.get('players', alex.id).name).toBe('Alexandre');
    const sam = a.store.list('players').find((p) => p.name === 'Sam');
    a.store.remove('players', sam.id);
    await settle();
    expect(b.store.get('players', sam.id)).toBeNull();
    vi.useRealTimers();
  });

  it('les modifications faites hors ligne partent au retour du réseau', async () => {
    vi.useFakeTimers();
    const server = new FakeServer();
    const a = await phone(server);
    const b = await phone(server);
    await settle();
    server.online = false;
    const g = a.store.save('games', { name: 'Hors ligne' });
    await settle();
    expect(b.store.get('games', g.id)).toBeNull();
    server.online = true;
    await vi.advanceTimersByTimeAsync(16000); // nouvel essai automatique
    await settle();
    expect(b.store.get('games', g.id).name).toBe('Hors ligne');
    vi.useRealTimers();
  });

  it('modifications faites app fermée : renvoyées au démarrage suivant', async () => {
    vi.useFakeTimers();
    const server = new FakeServer();
    const a = await phone(server);
    const g = a.store.save('games', { name: 'Azul' });
    await settle();
    a.engine.stop();
    a.store.save('games', { ...a.store.get('games', g.id), name: 'Azul (modifié)' }); // synchro arrêtée
    a.engine = new SyncEngine(a.store, server.remote(), { debounceMs: 10 }).start();
    await settle();
    const b = await phone(server);
    await settle();
    expect(b.store.get('games', g.id).name).toBe('Azul (modifié)');
    vi.useRealTimers();
  });

  it('une vieille version reçue ne remplace pas une plus récente', async () => {
    vi.useFakeTimers();
    const server = new FakeServer();
    const a = await phone(server);
    const g = a.store.save('games', { name: 'Récent' });
    await settle();
    server.docs.set(`games/${g.id}`, { col: 'games', record: { ...g, name: 'Ancien', updatedAt: g.updatedAt - 1000 } });
    for (const s of server.subs) s.onRecords([{ col: 'games', record: { ...g, name: 'Ancien', updatedAt: g.updatedAt - 1000 } }], {});
    await settle();
    expect(a.store.get('games', g.id).name).toBe('Récent');
    expect(JSON.parse(JSON.stringify(server.docs.get(`games/${g.id}`))).record.name).toBe('Récent'); // corrigé sur le serveur
    vi.useRealTimers();
  });
});

describe('code famille', () => {
  it('génère, formate et valide', () => {
    const code = generateFamilyCode();
    expect(code).toHaveLength(16);
    expect(formatFamilyCode(code)).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(normalizeFamilyCode(formatFamilyCode(code).toLowerCase())).toBe(code);
    expect(normalizeFamilyCode('trop court')).toBeNull();
    expect(normalizeFamilyCode('OOOO-OOOO-OOOO-OOOO')).toBeNull(); // O exclu (ambigu)
  });
});
