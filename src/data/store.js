// Magasin de données de l'application.
//
// Toutes les données (quelques centaines d'enregistrements au plus) sont
// chargées en mémoire au démarrage : les lectures sont synchrones, les
// écritures sont persistées de façon asynchrone dans le backend (IndexedDB).
// Avoir les données en mémoire permet aussi d'ouvrir le menu de partage natif
// immédiatement au toucher (Safari exige un geste utilisateur « frais »).
//
// Point d'extension pour une synchronisation en ligne :
//   - `onLocalChange(fn)` notifie chaque enregistrement modifié localement
//     (à pousser vers le serveur) ;
//   - `applyRemote(dataset)` fusionne des données reçues avec les mêmes règles
//     que l'import de fichier (dernière modification gagnante, suppressions
//     logiques), sans jamais rien écraser de plus récent.
import { COLLECTIONS, mergeDatasets } from './merge.js';
import { createRecord, touchRecord, tombstone } from './records.js';
import { buildExport, parseImport } from './exchange.js';

export class Store {
  constructor(backend) {
    this.backend = backend;
    this.data = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()]));
    this.listeners = new Set();
    this.localListeners = new Set();
    this.pending = Promise.resolve();
  }

  async init() {
    const all = await this.backend.loadAll();
    for (const c of COLLECTIONS) {
      this.data[c] = new Map((all[c] || []).map((r) => [r.id, r]));
    }
    return this;
  }

  // --- Lecture ---------------------------------------------------------------

  list(col, { includeDeleted = false } = {}) {
    const all = [...this.data[col].values()];
    return includeDeleted ? all : all.filter((r) => !r.deleted);
  }

  get(col, id, { includeDeleted = false } = {}) {
    const r = this.data[col].get(id);
    if (!r || (r.deleted && !includeDeleted)) return null;
    return r;
  }

  snapshot({ includeDeleted = true } = {}) {
    return Object.fromEntries(COLLECTIONS.map((c) => [c, this.list(c, { includeDeleted })]));
  }

  // --- Écriture --------------------------------------------------------------

  /** Crée ou met à jour un enregistrement. Retourne la version enregistrée. */
  save(col, fields) {
    const prev = fields.id ? this.data[col].get(fields.id) : null;
    const rec = prev ? touchRecord(prev, fields) : createRecord(fields);
    this.#write(col, [rec], 'local');
    return rec;
  }

  remove(col, id) {
    const prev = this.data[col].get(id);
    if (!prev || prev.deleted) return;
    this.#write(col, [tombstone(prev)], 'local');
  }

  #write(col, records, source) {
    for (const r of records) this.data[col].set(r.id, r);
    this.pending = this.pending
      .then(() => this.backend.putMany(col, records))
      .catch((e) => console.error('Écriture impossible', e));
    if (source === 'local') for (const fn of this.localListeners) fn(col, records);
    for (const fn of this.listeners) fn({ col, records, source });
  }

  /** Attend la fin des écritures en cours (utile avant export / dans les tests). */
  flush() {
    return this.pending;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onLocalChange(fn) {
    this.localListeners.add(fn);
    return () => this.localListeners.delete(fn);
  }

  // --- Fusion / partage --------------------------------------------------------

  /** Fusionne un jeu de données (import, exemples, ou futur serveur distant). */
  applyRemote(dataset, source = 'external') {
    const { changes, stats } = mergeDatasets(this.snapshot(), dataset);
    for (const c of COLLECTIONS) if (changes[c].length) this.#write(c, changes[c], source);
    return stats;
  }

  importText(text) {
    return this.applyRemote(parseImport(text));
  }

  exportData() {
    return buildExport(this.snapshot({ includeDeleted: true }));
  }

  async clearAll() {
    await this.flush();
    await this.backend.clear();
    for (const c of COLLECTIONS) this.data[c].clear();
    for (const fn of this.listeners) fn({ col: null, records: [], source: 'external' });
  }
}
