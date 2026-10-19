// Gestion de la synchronisation en ligne : activation par code famille,
// état courant, démarrage automatique à l'ouverture de l'app.
import { FIREBASE_CONFIG } from './config.js';
import { SYNC_STATUS, SyncEngine, formatFamilyCode, generateFamilyCode, normalizeFamilyCode } from './engine.js';

const KEY = 'ludo.sync';
let engine = null;
let state = { status: SYNC_STATUS.OFF, lastSync: null, error: null };
const listeners = new Set();

export { SYNC_STATUS, formatFamilyCode, normalizeFamilyCode };
export const syncAvailable = () => Boolean(FIREBASE_CONFIG);

export function getFamilyCode() {
  try {
    return normalizeFamilyCode(JSON.parse(localStorage.getItem(KEY))?.code);
  } catch {
    return null;
  }
}

function setCode(code) {
  try {
    if (code) localStorage.setItem(KEY, JSON.stringify({ code }));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignoré */
  }
}

export const syncState = () => ({ ...state, code: getFamilyCode() });

export function onSyncState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(patch) {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(syncState());
}

/** Démarre la synchro si un code famille est enregistré. */
export async function startSync(store) {
  const code = getFamilyCode();
  if (!code || !syncAvailable() || engine) return;
  emit({ status: SYNC_STATUS.CONNECTING, error: null });
  try {
    const { createFirebaseRemote } = await import('./firebase.js');
    const remote = await createFirebaseRemote(FIREBASE_CONFIG, code);
    engine = new SyncEngine(store, remote, {
      onStatus: ({ status, lastSync, error }) => emit({ status, lastSync, error: error ? String(error.message || error) : null }),
    }).start();
    window.addEventListener('online', () => engine?.resync());
  } catch (e) {
    console.warn('Synchronisation impossible', e);
    emit({ status: navigator.onLine === false ? SYNC_STATUS.OFFLINE : SYNC_STATUS.ERROR, error: String(e.message || e) });
    // Nouvel essai au retour du réseau.
    window.addEventListener('online', () => startSync(store), { once: true });
  }
}

export function stopSync() {
  engine?.stop();
  engine = null;
  setCode(null);
  emit({ status: SYNC_STATUS.OFF, lastSync: null, error: null });
}

/** Crée une nouvelle ludothèque partagée (nouveau code). */
export function createFamily(store) {
  stopSync();
  const code = generateFamilyCode();
  setCode(code);
  startSync(store);
  return code;
}

/** Rejoint une ludothèque partagée existante. Retourne false si le code est invalide. */
export function joinFamily(store, input) {
  const code = normalizeFamilyCode(input);
  if (!code) return false;
  stopSync();
  setCode(code);
  startSync(store);
  return true;
}

export const resyncNow = () => engine?.resync();
