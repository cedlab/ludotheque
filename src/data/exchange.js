// Format du fichier de partage / sauvegarde.
import { COLLECTIONS, isValidRecord } from './merge.js';

export const FILE_APP = 'ludotheque';
export const FILE_VERSION = 1;

export function buildExport(dataset, now = Date.now()) {
  const out = { app: FILE_APP, version: FILE_VERSION, exportedAt: now };
  // Les suppressions logiques sont incluses : c'est ce qui permet de les propager.
  for (const col of COLLECTIONS) out[col] = dataset[col] || [];
  return out;
}

export function exportFileName(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `ludotheque-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/** Lit et valide un fichier importé. Lève une erreur en français si invalide. */
export function parseImport(text) {
  let data;
  try {
    data = typeof text === 'string' ? JSON.parse(text) : text;
  } catch {
    throw new Error("Ce fichier n'est pas lisible (JSON invalide).");
  }
  if (!data || typeof data !== 'object' || data.app !== FILE_APP) {
    throw new Error("Ce fichier ne provient pas de l'application Ludothèque.");
  }
  if (!Number.isFinite(data.version) || data.version > FILE_VERSION) {
    throw new Error("Ce fichier a été créé par une version plus récente de l'application. Mettez-la à jour.");
  }
  const out = {};
  for (const col of COLLECTIONS) {
    const list = Array.isArray(data[col]) ? data[col] : [];
    out[col] = list.filter(isValidRecord);
  }
  return out;
}
