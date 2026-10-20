// Où en est un jeu : à la maison, testé ailleurs (asso, amis…) ou à acquérir — module pur.

export const GAME_LISTS = [
  { id: 'owned', label: 'Ma ludothèque', tab: 'Maison', one: 'À la maison', added: 'ajouté à la ludothèque', emoji: '🏠' },
  { id: 'tested', label: 'Testés', tab: 'Testés', one: 'Testé', added: 'ajouté aux jeux testés', emoji: '🧪' },
  { id: 'wishlist', label: 'À acquérir', tab: 'À acquérir', one: 'À acquérir', added: 'ajouté à la liste « À acquérir »', emoji: '🛒' },
];

const IDS = new Set(GAME_LISTS.map((l) => l.id));

export const listById = (id) => GAME_LISTS.find((l) => l.id === id) || GAME_LISTS[0];

/** Liste d'un jeu ; sans précision (anciens jeux, catalogue), il est à la maison. */
export const gameList = (game) => (IDS.has(game?.status) ? game.status : 'owned');

export const normalizeList = (id) => (IDS.has(id) ? id : 'owned');
