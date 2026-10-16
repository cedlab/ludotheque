// Réglages : partage / import, exemples, thème, installation, à propos.
import { store, refresh } from '../../app.js';
import { h, plural, setChildren } from '../dom.js';
import { icon } from '../icons.js';
import { confirmDialog, header, segmented, sheet, toast } from '../components.js';
import { exportFileName } from '../../data/exchange.js';
import { formatImportSummary } from '../../data/merge.js';
import { loadSamples } from './games.js';
import { canPromptInstall, checkForUpdate, isIOS, isStandalone, onInstallAvailable, promptInstall } from '../../pwa.js';
import { applyTheme, getTheme } from '../../theme.js';

/**
 * Partage le fichier via le menu natif (WhatsApp, Messages, mail…) ou, à
 * défaut, le télécharge. Doit être appelé directement depuis un geste
 * utilisateur : les données sont déjà en mémoire, aucun `await` avant share().
 */
export async function shareLibrary() {
  const json = JSON.stringify(store.exportData());
  const name = exportFileName();
  const file = new File([json], name, { type: 'application/json' });
  const count = store.list('games').length;
  const text = `Ma ludothèque (${plural(count, 'jeu', 'jeux')}) — ouvrez l’app Ludothèque puis « Importer » pour la fusionner avec la vôtre.`;

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Ma ludothèque', text });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return; // partage annulé par l'utilisateur
      console.warn('Partage impossible, téléchargement à la place', e);
    }
  }
  downloadFile(json, name);
}

export function downloadFile(json, name = exportFileName()) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = h('a', { href: url, download: name, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
  toast(`Fichier « ${name} » téléchargé.`);
}

export function importLibrary() {
  // Pas de filtre `accept` strict : certains téléphones nomment le fichier
  // reçu par messagerie sans extension .json.
  const input = h('input', { type: 'file', accept: '.json,application/json,text/plain,*/*', style: { display: 'none' } });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    try {
      const stats = store.importText(await file.text());
      await store.flush();
      const summary = formatImportSummary(stats);
      sheet(h('div', { class: 'stack center' },
        h('div', { class: 'empty-emoji' }, '📥'),
        h('p', { class: 'confirm-msg' }, summary),
        h('p', { class: 'muted small' }, 'Rien n’a été écrasé : pour chaque élément présent des deux côtés, la version la plus récente a été conservée.')),
      { title: 'Import terminé' });
    } catch (e) {
      toast(e.message || 'Import impossible.', { duration: 6000 });
    }
  });
  document.body.append(input);
  input.click();
}

function installHelp() {
  const ios = isIOS();
  return h('div', { class: 'stack' },
    ios
      ? h('ol', { class: 'steps' },
          h('li', null, 'Ouvrez cette page dans ', h('strong', null, 'Safari'), '.'),
          h('li', null, 'Touchez le bouton ', h('strong', null, 'Partager'), ' ', icon('share', 18), ' en bas de l’écran.'),
          h('li', null, 'Choisissez ', h('strong', null, '« Sur l’écran d’accueil »'), ' puis « Ajouter ».'))
      : h('ol', { class: 'steps' },
          h('li', null, 'Ouvrez cette page dans ', h('strong', null, 'Chrome'), '.'),
          h('li', null, 'Touchez le menu ', h('strong', null, '⋮'), ' en haut à droite.'),
          h('li', null, 'Choisissez ', h('strong', null, '« Installer l’application »'), ' ou « Ajouter à l’écran d’accueil ».')),
    h('p', { class: 'muted small' }, 'Une fois installée, l’app s’ouvre en plein écran et fonctionne sans connexion.'));
}

export function moreView() {
  const s = store.snapshot({ includeDeleted: false });
  const installBox = h('div');
  const drawInstall = () => {
    if (isStandalone()) {
      setChildren(installBox, h('p', { class: 'ok' }, '✅ L’application est installée sur cet appareil.'));
    } else if (canPromptInstall()) {
      setChildren(installBox, h('button', { class: 'btn primary', onclick: async () => { if (await promptInstall()) drawInstall(); } },
        icon('download'), 'Installer l’application'));
    } else {
      setChildren(installBox, installHelp());
    }
  };
  drawInstall();
  const off = onInstallAvailable(drawInstall);

  const el = h('div', null,
    header('Plus'),
    h('section', { class: 'card stack' },
      h('h3', null, '📲 Partage entre téléphones'),
      h('p', { class: 'muted' }, 'Envoyez votre ludothèque (jeux, logos, joueurs, parties) à un proche. De son côté, il l’importe : les données sont fusionnées, rien n’est écrasé.'),
      h('button', { class: 'btn primary big', onclick: shareLibrary }, icon('share'), 'Partager ma ludothèque'),
      h('button', { class: 'btn big', onclick: importLibrary }, icon('download'), 'Importer un fichier reçu'),
      h('p', { class: 'muted small' }, `Contenu : ${plural(s.games.length, 'jeu', 'jeux')}, ${plural(s.players.length, 'joueur', 'joueurs')}, ${plural(s.sessions.length, 'partie', 'parties')}.`)),
    h('section', { class: 'card stack' },
      h('h3', null, '💾 Sauvegarde'),
      h('p', { class: 'muted' }, 'Le fichier partagé sert aussi de sauvegarde complète. Gardez-en une copie (Fichiers, Drive, mail…) et réimportez-la sur un nouveau téléphone.'),
      h('button', { class: 'btn', onclick: () => downloadFile(JSON.stringify(store.exportData())) }, icon('download'), 'Télécharger une sauvegarde')),
    h('section', { class: 'card stack' },
      h('h3', null, '🎨 Apparence'),
      segmented([{ value: 'auto', label: 'Auto' }, { value: 'light', label: '☀️ Clair' }, { value: 'dark', label: '🌙 Sombre' }],
        getTheme(), (t) => applyTheme(t))),
    h('section', { class: 'card stack' }, h('h3', null, '📱 Installer sur l’écran d’accueil'), installBox),
    h('section', { class: 'card stack' },
      h('h3', null, '🎲 Données d’exemple'),
      h('p', { class: 'muted' }, '4 jeux classiques, 3 joueurs fictifs et quelques parties pour découvrir l’app. Les charger plusieurs fois ne crée pas de doublon.'),
      h('button', { class: 'btn', onclick: loadSamples }, 'Charger les exemples')),
    h('section', { class: 'card stack' },
      h('h3', null, 'ℹ️ À propos'),
      h('p', { class: 'muted small' }, `Ludothèque v${__APP_VERSION__}. Vos données restent sur cet appareil (aucun serveur, aucun compte).`),
      h('button', { class: 'btn ghost', onclick: async () => {
        toast((await checkForUpdate()) ? 'Mise à jour en cours de téléchargement…' : 'Vous avez la dernière version.');
      } }, 'Rechercher une mise à jour'),
      h('button', { class: 'btn danger-ghost', onclick: async () => {
        if (!(await confirmDialog('Effacer toutes les données de CET appareil ? Pensez à faire une sauvegarde avant. Cette action est irréversible.', { ok: 'Tout effacer', danger: true }))) return;
        await store.clearAll();
        toast('Données effacées.');
        refresh();
      } }, icon('trash'), 'Effacer les données de cet appareil')));
  return { el, cleanup: off };
}
