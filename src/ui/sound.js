// Bruitages synthétisés (Web Audio) : aucun fichier son à télécharger.
const KEY = 'ludo.sound';
let ctx = null;
let lastKnock = 0;

export function soundEnabled() {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* stockage indisponible */
  }
}

/** À appeler pendant un geste utilisateur (exigé par iOS pour jouer du son). */
export function unlockAudio() {
  if (!soundEnabled()) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

/** Petit « toc » de dé qui cogne, d'intensité proportionnelle au choc. */
export function knock(strength) {
  if (!ctx || !soundEnabled() || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (now - lastKnock < 0.025) return;
  lastKnock = now;
  const vol = Math.min(1, strength / 1100) * 0.45;
  if (vol < 0.02) return;

  // Claquement : bruit blanc très court filtré
  const len = Math.floor(ctx.sampleRate * 0.05);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1600 + Math.random() * 1600;
  band.Q.value = 1.4;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(vol, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  noise.connect(band).connect(ng).connect(ctx.destination);
  noise.start(now);

  // Corps : résonance boisée
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(190 + Math.random() * 90, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
  const og = ctx.createGain();
  og.gain.setValueAtTime(vol * 0.7, now);
  og.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  osc.connect(og).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}
