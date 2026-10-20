// Favoris par joueur : chaque jeu garde la liste des joueurs qui l'aiment — module pur.
import { normalizeName } from '../data/catalog.js';

/** Joueurs qui aiment ce jeu (seulement ceux qui existent encore, si on fournit la liste). */
export function fansOf(game, players = null) {
  const ids = Array.isArray(game?.favoriteOf) ? [...new Set(game.favoriteOf)] : [];
  if (!players) return ids;
  const alive = new Set(players.filter((p) => !p.deleted).map((p) => p.id));
  return ids.filter((id) => alive.has(id));
}

/** Ajoute ou retire un joueur des fans du jeu ; renvoie la nouvelle liste. */
export function toggleFan(game, playerId) {
  const ids = fansOf(game);
  return ids.includes(playerId) ? ids.filter((id) => id !== playerId) : [...ids, playerId];
}

/**
 * Filtre « Favoris de… » : sans joueur choisi, tout passe ; sinon le jeu doit
 * être aimé par au moins un (any) ou par tous (all) les joueurs choisis.
 */
export function gameMatchesFans(game, fanIds = [], mode = 'any') {
  if (fanIds.length === 0) return true;
  const fans = new Set(fansOf(game));
  return mode === 'all' ? fanIds.every((id) => fans.has(id)) : fanIds.some((id) => fans.has(id));
}

/** Prénom à qui reviennent les anciens favoris « famille » (seule Aurélie en avait mis). */
export const LEGACY_FAVORITES_OWNER = 'Aurélie';

/**
 * Anciens favoris (simple cœur, `favorite: true`) → favoris d'Aurélie.
 * Renvoie les jeux à enregistrer ; rien tant que son profil n'existe pas sur
 * cet appareil (la conversion se fera quand il arrivera).
 */
export function migrateLegacyFavorites(games, players, owner = LEGACY_FAVORITES_OWNER) {
  const target = normalizeName(owner);
  const person = players.find((p) => !p.deleted && normalizeName(p.name) === target);
  if (!person) return [];
  return games
    .filter((g) => g.favorite === true && !g.deleted)
    // `favorite: undefined` (et non une clé absente) : l'enregistrement repart de l'ancienne fiche.
    .map((g) => ({ ...g, favorite: undefined, favoriteOf: [...new Set([...fansOf(g), person.id])] }));
}
