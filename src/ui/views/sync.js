// Carte « Synchronisation » (Plus) et écran « Rejoindre » (lien d'invitation).
import { store, navigate } from '../../app.js';
import { h, setChildren } from '../dom.js';
import { icon } from '../icons.js';
import { confirmDialog, header, sheet, toast } from '../components.js';
import {
  SYNC_STATUS, createFamily, formatFamilyCode, joinFamily, normalizeFamilyCode, onSyncState, resyncNow,
  stopSync, syncAvailable, syncState,
} from '../../sync/index.js';

function ago(ms) {
  if (!ms) return '';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 10) return 'à l’instant';
  if (s < 60) return `il y a ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  return new Date(ms).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUS_TEXT = {
  [SYNC_STATUS.CONNECTING]: ['⏳', 'Connexion…'],
  [SYNC_STATUS.SYNCED]: ['✅', 'Synchronisé'],
  [SYNC_STATUS.SENDING]: ['🔄', 'Envoi des modifications…'],
  [SYNC_STATUS.OFFLINE]: ['📴', 'Hors ligne : les modifications partiront au retour du réseau'],
  [SYNC_STATUS.ERROR]: ['⚠️', 'Problème de synchronisation'],
};

export function inviteLink(code) {
  return `${location.origin}${location.pathname}#/rejoindre?code=${formatFamilyCode(code)}`;
}

async function shareInvite(code) {
  const url = inviteLink(code);
  const text = `Rejoins notre ludothèque partagée : ouvre ce lien sur ton téléphone (code ${formatFamilyCode(code)}).`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Ludothèque partagée', text, url });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast('Lien copié : collez-le dans un message.');
  } catch {
    toast(url, { duration: 10000 });
  }
}

function askCode() {
  const input = h('input', {
    class: 'input big code-input', type: 'text', placeholder: 'XXXX-XXXX-XXXX-XXXX', autocomplete: 'off',
    autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Code famille',
  });
  const s = sheet(h('form', { class: 'stack', onsubmit: (e) => {
    e.preventDefault();
    if (!joinFamily(store, input.value)) {
      toast('Ce code n’est pas valide (16 caractères).');
      return;
    }
    s.close();
    toast('Ludothèque partagée rejointe : synchronisation en cours…');
  } },
  h('p', { class: 'muted' }, 'Saisissez le code affiché sur l’autre téléphone (Plus → Synchronisation).'),
  input,
  h('button', { class: 'btn primary big', type: 'submit' }, 'Rejoindre')), { title: 'Rejoindre une ludothèque' });
  setTimeout(() => input.focus(), 100);
}

export function syncCard() {
  const box = h('section', { class: 'card stack' });
  let tick;
  const draw = () => {
    const st = syncState();
    if (!syncAvailable()) {
      setChildren(box, h('h3', null, '🔄 Synchronisation automatique'),
        h('p', { class: 'muted' }, 'Bientôt disponible : la configuration du serveur n’est pas encore faite.'));
      return;
    }
    if (!st.code) {
      setChildren(box,
        h('h3', null, '🔄 Synchronisation automatique'),
        h('p', { class: 'muted' }, 'Partagez la même ludothèque entre plusieurs téléphones : jeux, joueurs et parties se mettent à jour tout seuls dès qu’il y a du réseau.'),
        h('button', { class: 'btn primary big', onclick: async () => {
          if (!(await confirmDialog('Créer une ludothèque partagée à partir de celle de ce téléphone ? Vous pourrez ensuite inviter les autres téléphones.', { ok: 'Créer' }))) return;
          createFamily(store);
          draw();
        } }, icon('plus'), 'Créer une ludothèque partagée'),
        h('button', { class: 'btn big', onclick: askCode }, 'J’ai un code : rejoindre'),
        h('p', { class: 'muted small' }, 'Rien n’est écrasé : les ludothèques des téléphones sont fusionnées, la modification la plus récente l’emporte.'));
      return;
    }
    const [emoji, label] = STATUS_TEXT[st.status] || ['⏳', 'Connexion…'];
    setChildren(box,
      h('h3', null, '🔄 Synchronisation automatique'),
      h('p', { class: `sync-status ${st.status}` }, `${emoji} ${label}`,
        st.lastSync && st.status === SYNC_STATUS.SYNCED && h('small', { class: 'muted' }, ` · ${ago(st.lastSync)}`)),
      st.status === SYNC_STATUS.ERROR && st.error && h('p', { class: 'muted small' }, st.error),
      h('div', { class: 'code-box' }, h('small', { class: 'muted' }, 'Code famille'), h('strong', null, formatFamilyCode(st.code))),
      h('button', { class: 'btn primary', onclick: () => shareInvite(st.code) }, icon('share'), 'Inviter un autre téléphone'),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn ghost grow', onclick: () => { resyncNow(); toast('Synchronisation relancée.'); } }, 'Synchroniser maintenant'),
        h('button', { class: 'btn danger-ghost grow', onclick: async () => {
          if (!(await confirmDialog('Arrêter la synchronisation sur ce téléphone ? Ses données restent sur le téléphone ; les autres téléphones continuent de se synchroniser entre eux.', { ok: 'Arrêter', danger: true }))) return;
          stopSync();
          draw();
        } }, 'Arrêter')));
  };
  draw();
  const off = onSyncState(draw);
  tick = setInterval(draw, 30000);
  return { el: box, cleanup: () => { off(); clearInterval(tick); } };
}

/** #/rejoindre?code=… : lien d'invitation. */
export function joinView(_, query) {
  const code = normalizeFamilyCode(query.code);
  const current = syncState().code;
  const el = h('div', null, header('Ludothèque partagée', { back: '#/plus' }));
  const body = h('section', { class: 'card stack' });
  el.append(body);
  if (!syncAvailable() || !code) {
    setChildren(body, h('p', null, 'Ce lien d’invitation n’est pas valide.'));
  } else if (current === code) {
    setChildren(body, h('p', null, '✅ Ce téléphone fait déjà partie de cette ludothèque partagée.'),
      h('a', { class: 'btn', href: '#/' }, 'Voir les jeux'));
  } else {
    setChildren(body,
      h('div', { class: 'empty-emoji center-text' }, '🔄'),
      h('p', { class: 'confirm-msg' }, 'Rejoindre la ludothèque partagée de votre famille ?'),
      h('p', { class: 'muted' }, 'Les jeux, joueurs et parties de ce téléphone seront fusionnés avec ceux des autres, puis tout restera synchronisé automatiquement.'),
      current && h('p', { class: 'warn' }, '⚠️ Ce téléphone quittera sa ludothèque partagée actuelle.'),
      h('button', { class: 'btn primary big', onclick: () => {
        joinFamily(store, code);
        toast('Ludothèque partagée rejointe : synchronisation en cours…');
        navigate('/plus', { replace: true });
      } }, 'Rejoindre'));
  }
  return el;
}
