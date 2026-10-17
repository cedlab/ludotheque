// Jeux de la maison : ajoutés automatiquement à la ludothèque de chaque
// appareil (une fois par version du catalogue).
//
// Identifiants et dates fixes : la fusion habituelle s'applique, donc
//  - aucun doublon si le catalogue est appliqué plusieurs fois ;
//  - un jeu modifié ou supprimé sur le téléphone garde sa version (plus récente).
// Les informations (joueurs, durée, âge, comptage) sont celles des boîtes et
// restent modifiables dans l'app.

export const CATALOG_VERSION = 4;
const T = Date.UTC(2024, 0, 1);
// Date de la dernière révision du catalogue (v3 : vignettes). Plus récente que
// les versions précédentes : un jeu non modifié sur le téléphone reçoit la
// vignette ; un jeu modifié depuis (date plus récente) garde sa version.
const REVISED = Date.UTC(2024, 1, 1);
// v4 : jeux retirés de la maison. Ils restent dans la liste (leur position fixe
// les identifiants des suivants) mais sont publiés comme supprimés, ce qui les
// retire aussi des téléphones qui les avaient déjà.
const REMOVED_AT = Date.UTC(2024, 2, 1);
const REMOVED = new Set([
  'Mon premier jeu de parcours', 'Comme des petits singes', 'Premier jeu d’association (Nathan)',
  'Une cuillère pour Martin', 'Loto des p’tits incollables', 'Domino des p’tits incollables',
  'Maman et ses petits', 'Colorino', 'Énigmes ? Monde animal', 'Énigmes ? Corps humain',
  'Jeu de 32 cartes', 'One Piece : Deviens le roi des pirates',
]);

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
  // Ajouts (version 2 du catalogue) — toujours à la fin : l'ordre fixe les identifiants.
  ['Skyjo', 2, 8, 30, 8, sc('lowest', { rounds: true }), { notes: 'La partie s’arrête quand un joueur atteint 100 points. Le plus petit total gagne.' }],
  ['La Guerre des Moutons', 2, 4, 30, 10, HIGH],
  ['Speedbac', 2, 8, 20, 8, HIGH],
  ['Odin', 2, 6, 15, 8, sc('lowest', { rounds: true }), { notes: 'Chaque carte restant en main à la fin d’une manche vaut 1 point. Le plus petit total gagne.' }],
  ['Star Realms', 2, 2, 20, 12, sc('countdown', { startScore: 50, countdownWin: 'lastStanding' }), { notes: 'Chaque joueur commence avec 50 points d’influence.' }],
  ['Boursicocotte', 3, 5, 30, 10, HIGH],
  ['Texto!', 2, 6, 15, 8, HIGH],
  ['Énigmes ? Monde animal', 1, 6, 20, 7, HIGH],
  ['Énigmes ? Corps humain', 1, 6, 20, 7, HIGH],
  ['Le Petit Bac', 2, 8, 30, 8, sc('highest', { rounds: true })],
  ['Parade', 2, 6, 45, 10, sc('lowest'), { notes: 'Le plus petit total gagne.' }],
  ['Dobble', 2, 8, 15, 6, HIGH, { notes: 'Plusieurs versions à la maison.' }],
  ['Timeline', 2, 8, 15, 8, HIGH],
  ['Speed Runners', 2, 4, 15, 8, HIGH],
  ['Cortex Challenge', 2, 6, 15, 8, HIGH],
  ['Médiévallons', 2, 5, 20, 8, HIGH],
  ['Bazar Bizarre 2.0', 2, 8, 20, 8, HIGH],
  ['Codex Naturalis', 2, 4, 20, 7, HIGH],
  ['Bandido', 1, 4, 15, 6, COOP],
  ['De l’Orc pour les Braves', 2, 4, 15, 8, HIGH],
  ['Taboo XXL', 4, 10, 30, 12, sc('highest', { teams: true })],
  ['Sea Salt & Paper', 2, 4, 30, 8, sc('target', { target: 40, rounds: true }), { notes: 'Score à atteindre selon le nombre de joueurs : 40 à 2, 35 à 3, 30 à 4.' }],
  ['Trio', 3, 6, 15, 7, HIGH],
  ['Taco Loco', 2, 6, 15, 8, HIGH],
  ['That’s Not a Hat', 3, 8, 15, 8, sc('lowest'), { notes: 'Le moins de cartes pénalité l’emporte.' }],
  ['Service Compris !', 3, 6, 30, 10, HIGH],
  ['The Line', 2, 8, 15, 10, HIGH],
  ['Les Bâtisseurs : Moyen-Âge', 1, 4, 30, 10, HIGH],
  ['Similo : Animaux sauvages', 2, 8, 10, 7, COOP],
  ['Jeu de 32 cartes', 2, 6, 30, 8, HIGH, { notes: 'Belote, bataille, huit américain…' }],
  ['L’Imposteur', 3, 10, 20, 10, HIGH],
  ['Uno', 2, 10, 20, 7, sc('target', { target: 500, rounds: true }), { notes: 'Le gagnant d’une manche marque les points des cartes restant chez les autres.' }],
  ['One Piece : Deviens le roi des pirates', 2, 6, 30, 8, HIGH],
  ['Loup-Garou pour une nuit', 3, 10, 10, 9, HIGH],
  ['Duck & Cover', 2, 6, 20, 8, HIGH],
  ['The Crew : en quête de la neuvième planète', 2, 5, 20, 10, COOP],
];

// Vignettes : un dessin (emoji) qui évoque chaque jeu.
const ICONS = {
  'Splendor': '💎', 'Terraforming Mars': '🪐', 'Terraforming Mars : le jeu de dés': '🎲', 'Chakra': '🧘',
  'Kosmopolit': '🍜', 'Rauha': '🌲', 'Les Inventeurs': '💡', 'Battle Sheep': '🐑',
  'Les Aventuriers du Rail : Europe': '🚂', 'Ark Nova': '🐘', 'Secret Identity': '🕵️', 'Tranquillité': '🌊',
  'Château Combo': '🏰', 'Kingdomino': '👑', 'Fun Facts': '🤔', 'Azul': '🔷', 'Kids of London': '🧒',
  'Augustus': '🦅', 'Mysterium': '👻', 'Wingspan': '🐦', 'Wingspan Asie': '🦜', 'Seasons': '🍂',
  'Mémoire 44': '🪖', 'Scrabble Junior': '🔤', 'Fiesta de los Muertos': '💀', 'Sur les traces de Darwin': '🐢',
  'Codenames': '🔎', 'Mr. Jack': '🎩', '7 Wonders Duel': '⚔️', 'Las Vegas': '🎰', 'Zenith': '🌌',
  'The Manhattan Project': '☢️', 'Courtisans': '👸', 'Sushi Go Party!': '🍣', 'Yokai': '🦊', 'Faraway': '🏜️',
  'Little Town': '🏘️', 'Akropolis': '🏛️', '7 Wonders': '🗿', '7 Wonders Architects': '🏗️',
  'Monkey Palace': '🐒', 'It’s a Wonderful World': '🌍', 'Turing Machine': '🧮', 'Ceci n’est pas une pomme': '🍎',
  'Osmooz Couples': '💞', 'Osmooz Hot': '🔥', 'Mon premier jeu de parcours': '🐞', 'Comme des petits singes': '🐵',
  'Premier jeu d’association (Nathan)': '🧩', 'Une cuillère pour Martin': '🥄', 'Loto des p’tits incollables': '🦔',
  'Domino des p’tits incollables': '🐄', 'Maman et ses petits': '🐰', 'Colorino': '🌈',
  'Skyjo': '🃏', 'La Guerre des Moutons': '🐏', 'Speedbac': '⏱️', 'Odin': '🛡️', 'Star Realms': '🚀',
  'Boursicocotte': '🐔', 'Texto!': '💬', 'Énigmes ? Monde animal': '🦒', 'Énigmes ? Corps humain': '🫀',
  'Le Petit Bac': '✏️', 'Parade': '😼', 'Dobble': '👀', 'Timeline': '⏳', 'Speed Runners': '🏃',
  'Cortex Challenge': '🧠', 'Médiévallons': '🗡️', 'Bazar Bizarre 2.0': '🐭', 'Codex Naturalis': '🍄',
  'Bandido': '🦹', 'De l’Orc pour les Braves': '👹', 'Taboo XXL': '🤐', 'Sea Salt & Paper': '⛵', 'Trio': '3️⃣',
  'Taco Loco': '🌮', 'That’s Not a Hat': '🎁', 'Service Compris !': '🍽️', 'The Line': '📏',
  'Les Bâtisseurs : Moyen-Âge': '⚒️', 'Similo : Animaux sauvages': '🦁', 'Jeu de 32 cartes': '♠️',
  'L’Imposteur': '🎭', 'Uno': '🔴', 'One Piece : Deviens le roi des pirates': '🏴‍☠️', 'Loup-Garou pour une nuit': '🐺',
  'Duck & Cover': '🦆', 'The Crew : en quête de la neuvième planète': '👩‍🚀',
};

const pad = (n) => String(n).padStart(4, '0');

export function catalogGames() {
  return GAMES.map(([name, minPlayers, maxPlayers, duration, minAge, scoring, extra = {}], i) => ({
    id: `00000000-0000-4000-8000-00000001${pad(i + 1)}`,
    createdAt: T,
    updatedAt: REVISED,
    deleted: false,
    name,
    logo: null,
    minPlayers,
    maxPlayers,
    duration,
    minAge,
    scoring: structuredClone(scoring),
    dice: null,
    icon: ICONS[name] || null,
    notes: '',
    ...structuredClone(extra),
  })).map((g) => (REMOVED.has(g.name) ? { ...g, deleted: true, updatedAt: REMOVED_AT } : g));
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
  // Les jeux retirés (supprimés) passent toujours : leur suppression doit se propager.
  return catalogGames().filter((g) => g.deleted || ownIds.has(g.id) || !names.has(normalizeName(g.name)));
}
