// Backends de persistance. Interface commune :
//   loadAll()                  -> Promise<{ games: [], players: [], sessions: [] }>
//   putMany(collection, recs)  -> Promise<void>
//   clear()                    -> Promise<void>
// Un futur backend distant (Firebase…) peut implémenter la même interface, ou
// mieux, venir en complément : voir store.js (`applyRemote` / `onLocalChange`).
import { COLLECTIONS } from './merge.js';

export class MemoryBackend {
  constructor(initial = {}) {
    this.data = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map((initial[c] || []).map((r) => [r.id, r]))]));
  }
  async loadAll() {
    return Object.fromEntries(COLLECTIONS.map((c) => [c, [...this.data[c].values()]]));
  }
  async putMany(col, records) {
    for (const r of records) this.data[col].set(r.id, structuredClone(r));
  }
  async clear() {
    for (const c of COLLECTIONS) this.data[c].clear();
  }
}

const DB_NAME = 'ludotheque';
const DB_VERSION = 1;

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export class IndexedDBBackend {
  constructor(indexedDB = globalThis.indexedDB, name = DB_NAME) {
    this.idb = indexedDB;
    this.name = name;
    this.dbPromise = null;
  }

  open() {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const r = this.idb.open(this.name, DB_VERSION);
        r.onupgradeneeded = () => {
          const db = r.result;
          for (const c of COLLECTIONS) {
            if (!db.objectStoreNames.contains(c)) db.createObjectStore(c, { keyPath: 'id' });
          }
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.onblocked = () => reject(new Error('Base de données bloquée par un autre onglet.'));
      });
    }
    return this.dbPromise;
  }

  async loadAll() {
    const db = await this.open();
    const tx = db.transaction(COLLECTIONS, 'readonly');
    const entries = await Promise.all(COLLECTIONS.map(async (c) => [c, await req(tx.objectStore(c).getAll())]));
    return Object.fromEntries(entries);
  }

  async putMany(col, records) {
    if (!records.length) return;
    const db = await this.open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(col, 'readwrite');
      const os = tx.objectStore(col);
      for (const r of records) os.put(r);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Écriture annulée'));
    });
  }

  async clear() {
    const db = await this.open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(COLLECTIONS, 'readwrite');
      for (const c of COLLECTIONS) tx.objectStore(c).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
