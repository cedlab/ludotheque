// Création / modification d'enregistrements synchronisables.
// Tout enregistrement possède : id (UUID), createdAt, updatedAt, deleted.

export function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Repli pour les navigateurs anciens (contexte non sécurisé, etc.)
  const b = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Horodatage strictement croissant pour un même enregistrement. */
export function nextTimestamp(previous, now = Date.now()) {
  return Number.isFinite(previous) && previous >= now ? previous + 1 : now;
}

export function createRecord(fields = {}, now = Date.now()) {
  return {
    ...fields,
    id: fields.id || uuid(),
    createdAt: fields.createdAt ?? now,
    updatedAt: now,
    deleted: false,
  };
}

export function touchRecord(previous, fields, now = Date.now()) {
  return {
    ...previous,
    ...fields,
    id: previous.id,
    createdAt: previous.createdAt ?? now,
    updatedAt: nextTimestamp(previous.updatedAt, now),
    deleted: fields?.deleted ?? previous.deleted ?? false,
  };
}

/** Suppression logique : la « pierre tombale » se propage lors des fusions. */
export function tombstone(previous, now = Date.now()) {
  const t = touchRecord(previous, { deleted: true }, now);
  if ('logo' in t) t.logo = null; // inutile de transporter l'image d'un jeu supprimé
  return t;
}
