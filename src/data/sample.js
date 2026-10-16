// Données d'exemple (fictives). Identifiants fixes : les charger plusieurs fois
// ne crée aucun doublon, et elles ne remplacent jamais des données modifiées
// depuis (leurs dates sont anciennes, la fusion conserve le plus récent).

const T = Date.UTC(2024, 0, 1); // horodatage fixe des exemples
const day = 86400000;

const base = (id, i = 0) => ({ id, createdAt: T + i, updatedAt: T + i, deleted: false });

const P = {
  alex: '00000000-0000-4000-8000-00000000a001',
  sam: '00000000-0000-4000-8000-00000000a002',
  charlie: '00000000-0000-4000-8000-00000000a003',
};
const G = {
  skyjo: '00000000-0000-4000-8000-00000000b001',
  yams: '00000000-0000-4000-8000-00000000b002',
  uno: '00000000-0000-4000-8000-00000000b003',
  pandemie: '00000000-0000-4000-8000-00000000b004',
};

const players = [
  { ...base(P.alex, 1), name: 'Alex', color: '#E8743B', avatar: '🦊' },
  { ...base(P.sam, 2), name: 'Sam', color: '#2A9D8F', avatar: '🐢' },
  { ...base(P.charlie, 3), name: 'Charlie', color: '#7B5EA7', avatar: '🦉' },
];

const scoring = (s) => ({
  mode: 'highest', teams: false, rounds: false, startScore: 20,
  countdownWin: 'lastStanding', target: 100, coopScore: false, ...s,
});

const games = [
  {
    ...base(G.skyjo, 200), name: 'Skyjo', icon: '🃏', logo: null, minPlayers: 2, maxPlayers: 8, duration: 30, minAge: 8,
    scoring: scoring({ mode: 'lowest', rounds: true }),
    notes: 'La partie s’arrête quand un joueur dépasse 100 points. Le plus petit total gagne.',
  },
  {
    ...base(G.yams, 201), name: 'Yams', icon: '🎲', dice: { count: 5, faces: 6 }, logo: null, minPlayers: 1, maxPlayers: 6, duration: 30, minAge: 7,
    scoring: scoring({ mode: 'highest' }),
    notes: '5 dés, 3 lancers par tour. Bonus de 35 points si la partie haute atteint 63.',
  },
  {
    ...base(G.uno, 202), name: 'Uno', icon: '🔴', logo: null, minPlayers: 2, maxPlayers: 10, duration: 20, minAge: 6,
    scoring: scoring({ mode: 'target', target: 500, rounds: true }),
    notes: 'Le gagnant d’une manche marque les points des cartes restant chez les autres.',
  },
  {
    ...base(G.pandemie, 203), name: 'Pandémie', icon: '🦠', logo: null, minPlayers: 2, maxPlayers: 4, duration: 45, minAge: 8,
    scoring: scoring({ mode: 'coop', coopScore: false }),
    notes: 'Jeu coopératif : trouvez les 4 remèdes avant la fin de la pioche.',
  },
];

const snap = (ids) => ids.map((id) => {
  const p = players.find((x) => x.id === id);
  return { id: p.id, name: p.name, color: p.color, avatar: p.avatar, teamId: null };
});

const sessions = [
  {
    ...base('00000000-0000-4000-8000-00000000c001', 20),
    gameId: G.skyjo, gameName: 'Skyjo', scoring: games[0].scoring,
    players: snap([P.alex, P.sam, P.charlie]), teams: [],
    rounds: [
      { [P.alex]: 12, [P.sam]: 25, [P.charlie]: 8 },
      { [P.alex]: 18, [P.sam]: 3, [P.charlie]: 30 },
      { [P.alex]: 9, [P.sam]: 5, [P.charlie]: 40 },
    ],
    finals: {}, coop: { result: null, score: 0 },
    status: 'finished', startedAt: T + 2 * day, endedAt: T + 2 * day + 1800000,
  },
  {
    ...base('00000000-0000-4000-8000-00000000c002', 21),
    gameId: G.yams, gameName: 'Yams', scoring: games[1].scoring,
    players: snap([P.alex, P.sam, P.charlie]), teams: [],
    rounds: [], finals: { [P.alex]: 231, [P.sam]: 254, [P.charlie]: 198 }, coop: { result: null, score: 0 },
    status: 'finished', startedAt: T + 5 * day, endedAt: T + 5 * day + 1500000,
  },
  {
    ...base('00000000-0000-4000-8000-00000000c003', 22),
    gameId: G.uno, gameName: 'Uno', scoring: games[2].scoring,
    players: snap([P.alex, P.sam]), teams: [],
    rounds: [
      { [P.alex]: 120, [P.sam]: 0 },
      { [P.alex]: 0, [P.sam]: 210 },
      { [P.alex]: 190, [P.sam]: 0 },
      { [P.alex]: 230, [P.sam]: 0 },
    ],
    finals: {}, coop: { result: null, score: 0 },
    status: 'finished', startedAt: T + 7 * day, endedAt: T + 7 * day + 1200000,
  },
  {
    ...base('00000000-0000-4000-8000-00000000c004', 23),
    gameId: G.pandemie, gameName: 'Pandémie', scoring: games[3].scoring,
    players: snap([P.alex, P.sam, P.charlie]), teams: [],
    rounds: [], finals: {}, coop: { result: 'win', score: 0 },
    status: 'finished', startedAt: T + 9 * day, endedAt: T + 9 * day + 2700000,
  },
];

export function sampleData() {
  return structuredClone({ games, players, sessions });
}

/**
 * Données d'exemple adaptées à la ludothèque existante : un jeu d'exemple déjà
 * présent sous le même nom (ex. Skyjo du catalogue) n'est pas dupliqué, les
 * parties d'exemple sont rattachées au jeu existant.
 */
export function samplesFor(existingGames = [], normalize = (s) => s.toLowerCase().trim()) {
  const data = sampleData();
  const byName = new Map(existingGames.filter((g) => !g.deleted).map((g) => [normalize(g.name), g.id]));
  const remap = {};
  data.games = data.games.filter((g) => {
    const existing = byName.get(normalize(g.name));
    if (existing && existing !== g.id) {
      remap[g.id] = existing;
      return false;
    }
    return true;
  });
  for (const s of data.sessions) if (remap[s.gameId]) s.gameId = remap[s.gameId];
  return data;
}
