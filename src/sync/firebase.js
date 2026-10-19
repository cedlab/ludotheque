// Adaptateur Firebase (Firestore + connexion anonyme). Chargé à la demande,
// uniquement quand la synchronisation est activée.
//
// Stockage : families/{codeFamille}/records/{collection}__{id}
//   { col, updatedAt, json }  — l'enregistrement est stocké en JSON pour
//   éviter toute contrainte de format de Firestore.
// Le code famille (16 caractères aléatoires) est le secret partagé : seuls
// les téléphones qui le connaissent peuvent lire ou écrire (voir firestore.rules).
import { initializeApp, getApps } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import {
  collection, connectFirestoreEmulator, doc, getFirestore, onSnapshot, writeBatch,
} from 'firebase/firestore';

const BATCH_MAX = 400; // limite Firestore : 500 écritures par lot

export async function createFirebaseRemote(config, familyCode) {
  const { emulator, ...firebaseConfig } = config;
  const fresh = getApps().length === 0;
  const app = getApps()[0] || initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (emulator && fresh) {
    // Tests uniquement : émulateurs Firebase locaux.
    connectAuthEmulator(auth, `http://${emulator.host}:${emulator.authPort}`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulator.host, emulator.firestorePort);
  }
  await signInAnonymously(auth);
  const records = collection(db, 'families', familyCode, 'records');

  return {
    subscribe(onRecords, onError) {
      let first = true;
      return onSnapshot(records, { includeMetadataChanges: false }, (snap) => {
        const items = [];
        for (const change of snap.docChanges()) {
          if (change.type === 'removed') continue;
          const data = change.doc.data();
          try {
            items.push({ col: data.col, record: JSON.parse(data.json) });
          } catch {
            /* document illisible : ignoré */
          }
        }
        // Le tout premier instantané peut venir du cache : on attend celui du serveur.
        const initial = first && !snap.metadata.fromCache;
        if (initial) first = false;
        if (items.length || initial) onRecords(items, { initial });
      }, onError);
    },

    async write(items) {
      for (let i = 0; i < items.length; i += BATCH_MAX) {
        const batch = writeBatch(db);
        for (const { col, record } of items.slice(i, i + BATCH_MAX)) {
          batch.set(doc(records, `${col}__${record.id}`), {
            col, updatedAt: record.updatedAt, json: JSON.stringify(record),
          });
        }
        await batch.commit();
      }
    },
  };
}
