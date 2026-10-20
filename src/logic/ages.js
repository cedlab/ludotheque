// Filtre par âge minimum (« dès 6 ans », « dès 8 ans »…) — module pur.

/** Valeur utilisée pour les jeux sans âge indiqué. */
export const NO_AGE = 0;

export const ageOf = (game) => (Number(game?.minAge) > 0 ? Number(game.minAge) : NO_AGE);

/** Âges proposés dans le filtre : ceux des jeux, du plus jeune au plus âgé. */
export const ageOptions = (games) => [...new Set(games.map(ageOf))].sort((a, b) => a - b);

/** Sans âge coché, tout passe ; sinon l'âge du jeu doit faire partie des âges cochés. */
export const gameMatchesAges = (game, ages = []) => ages.length === 0 || ages.includes(ageOf(game));

export const ageLabel = (age) => (age === NO_AGE ? 'Âge non indiqué' : `Dès ${age} ans`);
