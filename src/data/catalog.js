// Jeux de la maison : ajoutés automatiquement à la ludothèque de chaque
// appareil (une fois par version du catalogue).
//
// Identifiants et dates fixes : la fusion habituelle s'applique, donc
//  - aucun doublon si le catalogue est appliqué plusieurs fois ;
//  - un jeu modifié ou supprimé sur le téléphone garde sa version (plus récente).
// Les informations (joueurs, durée, âge, comptage) sont celles des boîtes et
// restent modifiables dans l'app.

export const CATALOG_VERSION = 1;
const T = Date.UTC(2024, 0, 1);

const sc = (mode, extra = {}) => ({
  mode, teams: false, rounds: false, startScore: 20, countdownWin: 'lastStanding',
  target: 100, coopScore: false, ...extra,
});
const HIGH = sc('highest');
const COOP = sc('coop');

// [nom, joueurs min, joueurs max, durée (min), âge, comptage, extra]
const GAMES = [
  ['Splendor', 2, 4, 30, 10, HIGH, { notes: 'La fin de partie est déclenchée dès qu’un joueur atteint 15 points de prestige.' }],
  ['Terraforming Mars', 1, 5, 120, 12, HIGH],
  ['Terraforming Mars : le jeu de dés', 1, 4, 45, 14, HIGH],
  ['Chakra', 2, 4, 30, 8, HIGH],
  ['Kosmopolit', 4, 8, 15, 8, COOP],
  ['Rauha', 2, 5, 45, 10, HIGH],
  ['Les Inventeurs', 2, 5, 40, 10, HIGH],
  ['Battle Sheep', 2, 4, 15, 7, HIGH],
  ['Les Aventuriers du Rail : Europe', 2, 5, 60, 8, HIGH],
  ['Ark Nova', 1, 4, 120, 14, HIGH],
  ['Secret Identity', 3, 8, 30, 8, HIGH],
  ['Tranquillité', 1, 5, 20, 8, COOP],
  ['Château Combo', 2, 5, 25, 10, HIGH],
  ['Kingdomino', 2, 4, 15, 8, HIGH],
  ['Fun Facts', 3, 8, 30, 8, COOP],
  ['Azul', 2, 4, 40, 8, HIGH],
  ['Kids of London', 2, 5, 15, 8, HIGH],
  ['Augustus', 2, 6, 30, 8, HIGH],
  ['Mysterium', 2, 7, 45, 10, COOP],
  ['Wingspan', 1, 5, 60, 10, HIGH, { notes: 'Avec l’extension Océanie.' }],
  ['Wingspan Asie', 1, 2, 60, 10, HIGH, { notes: 'Jouable seul, ou jusqu’à 7 joueurs avec le jeu de base.' }],
  ['Seasons', 2, 4, 60, 14, HIGH],
  ['Mémoire 44', 2, 2, 60, 8, sc('target', { target: 6 }), { notes: 'Le premier à gagner le nombre de médailles du scénario l’emporte (souvent 6).' }],
  ['Scrabble Junior', 2, 4, 30, 6, HIGH],
  ['Fiesta de los Muertos', 4, 8, 15, 12, COOP],
  ['Sur les traces de Darwin', 2, 5, 30, 8, HIGH, { notes: 'Avec l’extension Correspondances.' }],
  ['Codenames', 2, 8, 15, 12, sc('highest', { teams: true }), { notes: 'Par équipes : donnez 1 point à l’équipe qui trouve tous ses agents.' }],
  ['Mr. Jack', 2, 2, 30, 9, HIGH],
  ['7 Wonders Duel', 2, 2, 30, 10, HIGH],
  ['Las Vegas', 2, 5, 30, 8, sc('highest', { rounds: true }), { dice: { count: 8, faces: 6 }, notes: '4 manches. Chaque joueur lance 8 dés.' }],
  ['Zenith', 2, 4, 20, 10, HIGH, { notes: 'À 2 joueurs, ou à 4 en équipes.' }],
  ['The Manhattan Project', 2, 5, 120, 14, HIGH],
  ['Courtisans', 2, 5, 30, 12, HIGH],
  ['Sushi Go Party!', 2, 8, 20, 8, sc('highest', { rounds: true }), { notes: '3 manches.' }],
  ['Yokai', 2, 4, 25, 8, COOP],
  ['Faraway', 2, 6, 30, 10, HIGH],
  ['Little Town', 2, 4, 45, 10, HIGH],
  ['Akropolis', 2, 4, 30, 8, HIGH],
  ['7 Wonders', 3, 7, 30, 10, HIGH],
  ['7 Wonders Architects', 2, 7, 25, 8, HIGH],
  ['Monkey Palace', 2, 4, 45, 10, HIGH],
  ['It’s a Wonderful World', 1, 5, 45, 14, HIGH],
  ['Turing Machine', 1, 4, 20, 14, HIGH, { notes: 'Le premier à trouver le code gagne.' }],
  ['Ceci n’est pas une pomme', 1, 1, 15, 6, COOP, { notes: 'Casse-tête en solo (Smart Games) : défis de difficulté croissante.' }],
  ['Osmooz Couples', 2, 2, 30, 18, COOP],
  ['Osmooz Hot', 2, 2, 30, 18, COOP],
  // Jeux des tout-petits
  ['Mon premier jeu de parcours', 2, 4, 10, 2, COOP],
  ['Comme des petits singes', 1, 4, 10, 2, COOP],
  ['Premier jeu d’association (Nathan)', 1, 4, 10, 2, COOP],
  ['Une cuillère pour Martin', 2, 4, 10, 2, COOP],
  ['Loto des p’tits incollables', 1, 4, 10, 1, COOP, { notes: 'Dès 18 mois.' }],
  ['Domino des p’tits incollables', 1, 4, 10, 1, COOP, { notes: 'Dès 18 mois.' }],
  ['Maman et ses petits', 1, 4, 10, 2, COOP],
  ['Colorino', 1, 4, 10, 2, COOP],
];

const pad = (n) => String(n).padStart(4, '0');

export function catalogGames() {
  return GAMES.map(([name, minPlayers, maxPlayers, duration, minAge, scoring, extra = {}], i) => ({
    id: `00000000-0000-4000-8000-00000001${pad(i + 1)}`,
    createdAt: T,
    updatedAt: T,
    deleted: false,
    name,
    logo: null,
    minPlayers,
    maxPlayers,
    duration,
    minAge,
    scoring: structuredClone(scoring),
    dice: null,
    notes: '',
    ...structuredClone(extra),
  }));
}

/** Nom simplifié pour repérer un même jeu saisi à la main (accents, ponctuation…). */
export function normalizeName(name = '') {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Jeux du catalogue à fusionner : on écarte ceux qui existent déjà sous un
 * autre identifiant (même nom, ajouté à la main), pour éviter les doublons.
 */
export function catalogToMerge(existingGames = []) {
  const ownIds = new Set(existingGames.map((g) => g.id));
  const names = new Set(existingGames.filter((g) => !g.deleted).map((g) => normalizeName(g.name)));
  return catalogGames().filter((g) => ownIds.has(g.id) || !names.has(normalizeName(g.name)));
}
