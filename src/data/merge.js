// Fusion de données — module pur, sans accès au stockage.
//
// Règles :
//  - chaque enregistrement a un `id` (UUID) et un `updatedAt` (ms epoch) ;
//  - un élément inconnu localement est ajouté ;
//  - s'il existe des deux côtés, la version la plus récente gagne ;
//  - en cas d'égalité stricte des dates mais de contenus différents, un
//    départage déterministe (comparaison du contenu sérialisé) garantit que
//    deux appareils qui fusionnent dans un sens ou dans l'autre convergent ;
//  - les suppressions sont des « pierres tombales » (`deleted: true`) qui se
//    propagent comme n'importe quelle modification.
//
// Ce module est volontairement indépendant du transport : il sert à l'import
// de fichier aujourd'hui et pourra servir demain à une synchronisation en
// ligne (Firebase ou autre) sans modification.

export const COLLECTIONS = ['games', 'players', 'sessions'];

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

export function isValidRecord(r) {
  return (
    r !== null &&
    typeof r === 'object' &&
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    Number.isFinite(r.updatedAt)
  );
}

/** Retourne la version qui doit l'emporter entre deux versions d'un même élément. */
export function pickWinner(local, incoming) {
  if (!local) return incoming;
  if (!incoming) return local;
  if (incoming.updatedAt > local.updatedAt) return incoming;
  if (incoming.updatedAt < local.updatedAt) return local;
  const a = stableStringify(local);
  const b = stableStringify(incoming);
  return b > a ? incoming : local;
}

/**
 * Fusionne une liste entrante dans une liste locale.
 * Retourne { changes, stats } où `changes` contient uniquement les
 * enregistrements à écrire localement.
 */
export function mergeCollection(localList = [], incomingList = []) {
  const local = new Map(localList.map((r) => [r.id, r]));
  const changes = new Map();
  const stats = { added: 0, updated: 0, deleted: 0, ignored: 0 };

  for (const incoming of incomingList) {
    if (!isValidRecord(incoming)) {
      stats.ignored++;
      continue;
    }
    const current = changes.get(incoming.id) ?? local.get(incoming.id);
    const winner = pickWinner(current, incoming);
    if (winner === current) continue;
    if (current && stableStringify(current) === stableStringify(incoming)) continue;
    changes.set(incoming.id, incoming);
  }

  for (const [id, rec] of changes) {
    const original = local.get(id);
    if (!original) {
      if (!rec.deleted) stats.added++;
    } else if (rec.deleted && !original.deleted) {
      stats.deleted++;
    } else if (!(rec.deleted && original.deleted)) {
      stats.updated++;
    }
  }

  return { changes: [...changes.values()], stats };
}

/** Fusionne des jeux de données complets { games, players, sessions }. */
export function mergeDatasets(local, incoming) {
  const changes = {};
  const stats = {};
  for (const col of COLLECTIONS) {
    const res = mergeCollection(local?.[col] || [], incoming?.[col] || []);
    changes[col] = res.changes;
    stats[col] = res.stats;
  }
  return { changes, stats };
}

/** Applique des changements à un jeu de données (copie). Pratique pour les tests. */
export function applyChanges(dataset, changes) {
  const out = {};
  for (const col of COLLECTIONS) {
    const map = new Map((dataset?.[col] || []).map((r) => [r.id, r]));
    for (const r of changes?.[col] || []) map.set(r.id, r);
    out[col] = [...map.values()];
  }
  return out;
}

// --- Résumé en français -----------------------------------------------------

const NOUNS = {
  sessions: { one: 'partie', many: 'parties', feminine: true },
  games: { one: 'jeu', many: 'jeux', feminine: false },
  players: { one: 'joueur', many: 'joueurs', feminine: false },
};
const ORDER = ['sessions', 'games', 'players'];

function joinFr(parts) {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`;
}

function phrase(stats, key, forms) {
  const items = ORDER.filter((c) => stats[c]?.[key] > 0).map((c) => ({ c, n: stats[c][key] }));
  if (items.length === 0) return null;
  const parts = items.map(({ c, n }) => `${n} ${n > 1 ? NOUNS[c].many : NOUNS[c].one}`);
  const plural = items.length > 1 || items[0].n > 1;
  const feminine = items.every(({ c }) => NOUNS[c].feminine);
  const verb = forms[(feminine ? 'f' : 'm') + (plural ? 'p' : 's')];
  return `${joinFr(parts)} ${verb}`;
}

/** Ex. : « 3 parties et 1 jeu ajoutés · 1 joueur mis à jour ». */
export function formatImportSummary(stats) {
  const sentences = [
    phrase(stats, 'added', { ms: 'ajouté', mp: 'ajoutés', fs: 'ajoutée', fp: 'ajoutées' }),
    phrase(stats, 'updated', { ms: 'mis à jour', mp: 'mis à jour', fs: 'mise à jour', fp: 'mises à jour' }),
    phrase(stats, 'deleted', { ms: 'supprimé', mp: 'supprimés', fs: 'supprimée', fp: 'supprimées' }),
  ].filter(Boolean);
  if (sentences.length === 0) return 'Rien de nouveau : votre ludothèque était déjà à jour.';
  return sentences.join(' · ');
}
