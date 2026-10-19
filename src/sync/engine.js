// Moteur de synchronisation en ligne — indépendant du service utilisé.
//
// Le « distant » est un simple adaptateur :
//   subscribe(onRecords, onError) -> unsubscribe
//       onRecords([{ col, record }], { initial }) est appelé avec les
//       enregistrements créés ou modifiés à distance (la première fois : tout).
//   write([{ col, record }]) -> Promise
//
// Règles : exactement celles de l'import de fichier (store.applyRemote) — la
// modification la plus récente gagne, les suppressions se propagent.
// Au démarrage, tout ce qui est plus récent ici que sur le serveur y est
// envoyé : les modifications faites hors ligne (même app fermée) ne sont
// jamais perdues.
import { COLLECTIONS } from '../data/merge.js';

export const SYNC_STATUS = {
  OFF: 'off',
  CONNECTING: 'connecting',
  SYNCED: 'synced',
  SENDING: 'sending',
  OFFLINE: 'offline',
  ERROR: 'error',
};

const key = (col, id) => `${col}/${id}`;

/** Enregistrements locaux à envoyer : absents du serveur ou plus récents qu'au serveur. */
export function recordsToPush(store, remoteVersions) {
  const out = [];
  for (const col of COLLECTIONS) {
    for (const r of store.list(col, { includeDeleted: true })) {
      const remote = remoteVersions.get(key(col, r.id));
      if (remote === undefined || r.updatedAt > remote) out.push({ col, record: r });
    }
  }
  return out;
}

export class SyncEngine {
  constructor(store, remote, { onStatus = () => {}, debounceMs = 400 } = {}) {
    Object.assign(this, { store, remote, onStatus, debounceMs });
    this.remoteVersions = new Map(); // "col/id" -> updatedAt connu côté serveur
    this.queue = new Map();
    this.timer = null;
    this.ready = false;
    this.lastSync = null;
    this.status = SYNC_STATUS.OFF;
  }

  #setStatus(status, extra = {}) {
    this.status = status;
    this.onStatus({ status, lastSync: this.lastSync, ...extra });
  }

  start() {
    this.#setStatus(SYNC_STATUS.CONNECTING);
    this.offLocal = this.store.onLocalChange((col, records) => {
      for (const record of records) this.queue.set(key(col, record.id), { col, record });
      this.#schedule();
    });
    this.unsubscribe = this.remote.subscribe(
      (items, meta = {}) => this.#onRemote(items, meta),
      (err) => this.#setStatus(SYNC_STATUS.ERROR, { error: err }),
    );
    return this;
  }

  stop() {
    clearTimeout(this.timer);
    this.offLocal?.();
    this.unsubscribe?.();
    this.ready = false;
    this.#setStatus(SYNC_STATUS.OFF);
  }

  #onRemote(items, { initial = false } = {}) {
    const dataset = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
    for (const { col, record } of items) {
      if (!dataset[col] || !record) continue;
      dataset[col].push(record);
      const k = key(col, record.id);
      this.remoteVersions.set(k, Math.max(this.remoteVersions.get(k) ?? -Infinity, record.updatedAt));
    }
    const stats = this.store.applyRemote(dataset, 'external');
    this.lastSync = Date.now();
    // Si notre version est plus récente que celle reçue, c'est à nous de la renvoyer.
    for (const { col, record } of items) {
      const mine = record && this.store.get(col, record.id, { includeDeleted: true });
      if (mine && mine.updatedAt > record.updatedAt) this.queue.set(key(col, mine.id), { col, record: mine });
    }
    if (initial || !this.ready) {
      this.ready = true;
      // Envoie ce que le serveur n'a pas (ou a en plus ancien).
      for (const item of recordsToPush(this.store, this.remoteVersions)) {
        this.queue.set(key(item.col, item.record.id), item);
      }
      this.#schedule(0);
    }
    if (this.queue.size) this.#schedule(0);
    if (!this.queue.size) this.#setStatus(SYNC_STATUS.SYNCED, { stats });
    else this.onStatus({ status: this.status, lastSync: this.lastSync, stats });
  }

  #schedule(delay = this.debounceMs) {
    if (!this.ready) return; // on attend de connaître l'état du serveur
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), delay);
  }

  /** Envoie les modifications en attente. */
  async flush() {
    if (!this.ready || !this.queue.size) return;
    const batch = [...this.queue.values()];
    this.queue.clear();
    this.#setStatus(SYNC_STATUS.SENDING);
    try {
      await this.remote.write(batch);
      for (const { col, record } of batch) {
        const k = key(col, record.id);
        this.remoteVersions.set(k, Math.max(this.remoteVersions.get(k) ?? -Infinity, record.updatedAt));
      }
      this.lastSync = Date.now();
      this.#setStatus(this.queue.size ? SYNC_STATUS.SENDING : SYNC_STATUS.SYNCED);
    } catch (err) {
      // On remet en file (sans écraser une version plus récente arrivée entre-temps).
      for (const item of batch) {
        const k = key(item.col, item.record.id);
        if (!this.queue.has(k)) this.queue.set(k, item);
      }
      this.#setStatus(navigator?.onLine === false ? SYNC_STATUS.OFFLINE : SYNC_STATUS.ERROR, { error: err });
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), 15000);
    }
  }

  /** Renvoie tout ce qui est plus récent ici que sur le serveur (bouton « Synchroniser »). */
  resync() {
    for (const item of recordsToPush(this.store, this.remoteVersions)) {
      this.queue.set(key(item.col, item.record.id), item);
    }
    return this.flush();
  }
}

// --- Code famille -----------------------------------------------------------

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans 0/O, 1/I/L

export function generateFamilyCode(random = cryptoRandom) {
  let s = '';
  for (let i = 0; i < 16; i++) s += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return s;
}

/** Normalise une saisie (minuscules, espaces, tirets) ; null si invalide. */
export function normalizeFamilyCode(input = '') {
  const s = String(input).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length !== 16 || [...s].some((c) => !ALPHABET.includes(c))) return null;
  return s;
}

export const formatFamilyCode = (code) => code.match(/.{1,4}/g).join('-');

function cryptoRandom() {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}
