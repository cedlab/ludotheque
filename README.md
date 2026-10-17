# 🎲 Ludothèque

Le compagnon de jeux de société de la famille, sur iPhone et Android.
C'est une application web installable (PWA) qui fonctionne **hors ligne**.

👉 **https://cedlab.github.io/ludotheque/**

- **Collection de jeux** : fiche par jeu (logo photo ou icône automatique, nombre de joueurs, durée, âge, type de score, notes). Filtres par nombre de joueurs, durée et âge, et bouton **« À quoi joue-t-on ? »** qui tire un jeu au hasard.
- **Tirage au doigt** : chacun pose un doigt sur l'écran. Après environ 2 s d'immobilité, un compte à rebours démarre, puis un doigt est désigné au hasard. On peut aussi tirer l'ordre complet de jeu ou former des équipes.
- **Scores** : le plus haut gagne, le plus bas gagne, score de départ décompté (501, 20 PV… ; le premier à 0 gagne ou le dernier en vie), score cible, coopératif, par équipes. Saisie manche par manche ou score final, gestion des égalités. Les gros boutons +/- s'utilisent d'une main.
- **Historique et statistiques** : victoires par joueur, jeux les plus joués, meilleur score par jeu, séries de victoires.
- **Lanceur de dés** : de 1 à 12 dés (D4, D6, D8, D10, D12, D20, D100). Les dés sont lancés sur un tapis : ils rebondissent, se cognent (avec un petit bruit, désactivable) et ralentissent avant de se poser. On touche un dé pour le garder au lancer suivant. Le total et l'historique s'affichent. Chaque jeu peut avoir son réglage (« Yams : 5 × D6 »).
- **Partage entre téléphones** par fichier, avec une fusion intelligente qui n'écrase jamais rien. Ce fichier sert aussi de sauvegarde.

Aucun compte, aucun serveur : les données restent sur le téléphone (IndexedDB).

---

## Utilisation

1. **Jeux** : au premier lancement, la ludothèque contient déjà les jeux de la maison (`src/data/catalog.js`, environ 80 jeux avec leur vignette illustrée, tous modifiables ou supprimables). Un champ de recherche et des filtres aident à s'y retrouver. Pour en ajouter un, touchez **+**. Pour le logo, vous pouvez prendre une photo ou choisir une image : elle est recadrée en carré et compressée à 100 Ko maximum. Sans photo, le jeu affiche une vignette (« Choisir une vignette ») ou, à défaut, ses initiales. Pour découvrir l'app, utilisez **Plus → Charger les exemples**.
2. **Joueurs** : créez un profil par personne (prénom, couleur, avatar).
3. **Parties → Nouvelle partie** : choisissez le jeu, puis les joueurs (et les équipes si besoin). Touchez **C'est parti !**
   - **+ / −** ajoutent ou retirent des points, selon le pas choisi (1, 5, 10, 50). Touchez un nombre pour le saisir au clavier.
   - En mode manche par manche, utilisez **Manche suivante**. **Manches** affiche le tableau détaillé, dont chaque case est modifiable.
   - Un bandeau annonce le gagnant dès que la condition de victoire est atteinte (cible, 0 point, dernier survivant).
   - **Terminer** affiche le podium. Depuis l'écran des résultats : **Rejouer**, **Corriger les scores** ou **Supprimer**.
4. **Dés** : bouton 🎲 en haut à gauche de l'accueil, dans la fiche d'un jeu ou pendant une partie (réglage du jeu par défaut). Touchez un dé pour le garder, 🔒 apparaît.
5. **Tirage** (bouton central) : posez tous un doigt sur l'écran et ne bougez plus. Si un doigt est levé, ajouté ou déplacé, le tirage recommence. Les modes **Premier joueur**, **Ordre** et **Équipes** (2 à 4) se choisissent en haut de l'écran. Le tirage accepte autant de doigts que l'écran en détecte (5 sur iPhone, souvent 10 sur Android).

### Comment les scores sont calculés

| Type | Gagnant | Égalité |
|---|---|---|
| Le plus haut gagne | Total le plus élevé | Mêmes totaux |
| Le plus bas gagne | Total le plus faible | Mêmes totaux |
| Décompte, premier à 0 | Le premier (en manches) à atteindre 0 | Plusieurs à 0 dans la même manche |
| Décompte, dernier en vie | Le dernier au-dessus de 0. Les éliminés sont classés du plus tard au plus tôt | Derniers survivants éliminés dans la même manche |
| Score cible | Le premier à atteindre la cible. Si plusieurs l'atteignent dans la même manche, le plus haut l'emporte | Même manche et même score |
| Coopératif | Tout le groupe gagne ou perd. Score de groupe facultatif | — |
| Par équipes | Option combinable avec les modes ci-dessus : les scores sont saisis par équipe, et chaque membre de l'équipe gagnante est compté gagnant | — |

En mode décompte, les points saisis sont retirés du score de départ, et l'écran affiche les points restants.

---

## Installer sur l'écran d'accueil

### iPhone (Safari)
1. Ouvrez **https://cedlab.github.io/ludotheque/** dans **Safari**.
2. Touchez **Partager** (le carré avec une flèche vers le haut).
3. Choisissez **« Sur l'écran d'accueil »**, puis **Ajouter**.

### Android (Chrome)
1. Ouvrez l'adresse dans **Chrome**.
2. Touchez **« Installer l'application »** si le bandeau apparaît, ou passez par le menu **⋮ → Installer l'application** (ou « Ajouter à l'écran d'accueil »).

Une fois installée, l'app s'ouvre en plein écran et fonctionne sans connexion. Quand une nouvelle version est publiée, un message **« Mettre à jour »** apparaît au prochain lancement.

---

## Partager entre téléphones

1. Sur le téléphone A : **Plus → Partager ma ludothèque**. Le menu de partage du téléphone s'ouvre : envoyez le fichier par WhatsApp, Messages, mail… Si le partage n'est pas disponible, le fichier `ludotheque-AAAA-MM-JJ.json` est téléchargé.
2. Sur le téléphone B : enregistrez le fichier reçu (dans « Fichiers » sur iPhone), puis **Plus → Importer un fichier reçu** et choisissez-le.
3. Un résumé s'affiche, par exemple « 3 parties et 1 jeu ajoutés ».

Règles de fusion (aucune donnée n'est jamais écrasée à l'aveugle) :
- chaque jeu, joueur et partie possède un identifiant unique (UUID) et une date de dernière modification ;
- un élément inconnu est ajouté ; s'il existe des deux côtés, **la version modifiée le plus récemment gagne** ;
- les suppressions sont propagées : un élément supprimé est conservé comme « supprimé » pour que l'autre téléphone le supprime aussi ;
- importer plusieurs fois le même fichier ne crée **aucun doublon**.

Pour que les deux téléphones aient la même ludothèque, faites l'échange dans les deux sens (A → B, puis B → A).

> ℹ️ « La plus récente gagne » s'appuie sur l'horloge des téléphones. Laissez-les en réglage automatique de l'heure.

## Sauvegarder

Le fichier de partage est une **sauvegarde complète**, logos compris. Pour sauvegarder, utilisez **Plus → Télécharger une sauvegarde** (ou Partager), puis gardez le fichier dans Fichiers, Drive, vos mails… Pour restaurer, importez-le, sur le même téléphone ou sur un nouveau.

Faites une sauvegarde de temps en temps. Si vous n'installez pas l'app sur l'écran d'accueil, Safari peut effacer les données d'un site après plusieurs semaines sans visite.

---

## Développement

Prérequis : Node.js 20.19+ (22 recommandé).

```bash
npm install
npm run dev       # serveur de développement : http://localhost:5173/ludotheque/
npm test          # tests automatisés (Vitest)
npm run build     # compilation dans dist/ (+ génération du service worker)
npm run preview   # sert dist/ : http://localhost:4173/ludotheque/
npm run icons     # régénère les icônes PNG
```

Le service worker n'est actif que dans la version compilée (`build` / `preview`).

### Structure

```
src/
  logic/scoring.js        calcul des résultats (tous les modes, égalités, manches, équipes)
  logic/stats.js          statistiques (victoires, séries, meilleurs scores…)
  logic/picker-engine.js  moteur du tirage au doigt (sans DOM, testable)
  data/records.js         UUID, horodatage, suppression logique
  data/merge.js           fusion « la plus récente gagne » + résumé en français
  data/exchange.js        format du fichier de partage / sauvegarde
  data/backends.js        persistance : IndexedDB (et mémoire pour les tests)
  data/store.js           magasin en mémoire + écriture IndexedDB + points d'extension de synchro
  data/catalog.js         jeux de la maison, ajoutés automatiquement (identifiants fixes)
  data/sample.js          données d'exemple (fictives, identifiants fixes)
  ui/…                    écrans et composants (JavaScript sans framework)
  sw.js                   modèle du service worker (complété au build)
tests/                    tests Vitest
```

### Brancher une synchronisation en ligne plus tard

Le stockage est déjà prêt pour une synchronisation (Firebase, Supabase…) :
- `store.onLocalChange((collection, records) => …)` signale chaque modification locale, à envoyer au serveur ;
- `store.applyRemote({ games, players, sessions })` fusionne ce qui arrive du serveur avec les mêmes règles que l'import de fichier ;
- les enregistrements portent déjà `id`, `updatedAt` et `deleted`, ce qui suffit pour une synchronisation incrémentale (« tout ce qui a changé depuis T »).

### Déploiement

- `.github/workflows/tests.yml` lance les tests et la compilation à chaque push et sur chaque pull request.
- `.github/workflows/deploy.yml` teste, compile et déploie sur GitHub Pages à chaque push sur `main`.

Configuration à faire une seule fois : dans le dépôt GitHub, **Settings → Pages → Build and deployment → Source : « GitHub Actions »**.

L'app est servie depuis le sous-chemin `/ludotheque/`. La base Vite, le manifest (`start_url`/`scope` relatifs) et la portée du service worker en dépendent. Pour un autre hébergement : `BASE_PATH=/ npm run build`.

À chaque build, la version du service worker est calculée à partir du contenu des fichiers. Tout changement produit donc un nouveau `sw.js`, que le navigateur détecte, et l'app propose la mise à jour.

### Confidentialité

Le dépôt est public et ne contient aucune donnée personnelle. Les exemples utilisent des prénoms fictifs. Les données des utilisateurs ne quittent leur téléphone que s'ils partagent eux-mêmes un fichier.
