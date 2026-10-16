// Logo de jeu : sélection d'une photo, recadrage carré, compression ≤ ~100 Ko.
import { h } from './dom.js';
import { sheet, toast } from './components.js';

export const MAX_LOGO_BYTES = 100 * 1024;

/** Ouvre le sélecteur de fichiers natif. `camera` force l'appareil photo. */
export function pickImageFile({ camera = false } = {}) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    if (camera) input.setAttribute('capture', 'environment');
    input.addEventListener('change', () => {
      resolve(input.files?.[0] || null);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible'));
    };
    img.src = url;
  });
}

const dataUrlBytes = (d) => Math.ceil(((d.length - d.indexOf(',') - 1) * 3) / 4);

/**
 * Dessine la zone choisie dans un carré et compresse en JPEG jusqu'à passer
 * sous la limite (réduction de la qualité puis de la taille).
 */
export function renderSquare(img, crop, maxBytes = MAX_LOGO_BYTES) {
  const sizes = [512, 384, 288, 200];
  const qualities = [0.85, 0.75, 0.65, 0.55, 0.45];
  let last = null;
  for (const size of sizes) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, crop.sx, crop.sy, crop.side, crop.side, 0, 0, size, size);
    for (const q of qualities) {
      last = canvas.toDataURL('image/jpeg', q);
      if (dataUrlBytes(last) <= maxBytes) return last;
    }
  }
  return last;
}

/**
 * Recadrage interactif : l'image se déplace au doigt dans un cadre carré,
 * un curseur règle le zoom (pincement à deux doigts également possible).
 * Retourne une data URL JPEG, ou null si annulé.
 */
export async function cropImage(file) {
  let loaded;
  try {
    loaded = await loadImage(file);
  } catch {
    toast("Impossible de lire cette image.");
    return null;
  }
  const { img, url } = loaded;
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const minSide = Math.min(W, H);

  return new Promise((resolve) => {
    let done = false;
    // État du cadrage dans les coordonnées de l'image
    let zoom = 1; // 1 = le petit côté remplit le cadre
    let cx = W / 2;
    let cy = H / 2;

    const view = h('div', { class: 'crop-view' });
    const pic = h('img', { src: url, alt: '', class: 'crop-img', draggable: 'false' });
    view.append(pic, h('div', { class: 'crop-frame' }));

    const side = () => minSide / zoom;
    const clamp = () => {
      const s = side() / 2;
      cx = Math.min(W - s, Math.max(s, cx));
      cy = Math.min(H - s, Math.max(s, cy));
    };
    const layout = () => {
      clamp();
      const vw = view.clientWidth || 300;
      const scale = vw / side();
      pic.style.width = `${W * scale}px`;
      pic.style.height = `${H * scale}px`;
      pic.style.transform = `translate(${vw / 2 - cx * scale}px, ${vw / 2 - cy * scale}px)`;
    };

    const range = h('input', {
      type: 'range', min: '1', max: '4', step: '0.01', value: '1', 'aria-label': 'Zoom',
      oninput: () => { zoom = Number(range.value); layout(); },
    });

    // Glisser / pincer
    const pointers = new Map();
    let pinchStart = null;
    view.addEventListener('pointerdown', (e) => {
      view.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      }
    });
    view.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const scale = (view.clientWidth || 300) / side();
      if (pointers.size === 1) {
        cx -= (e.clientX - p.x) / scale;
        cy -= (e.clientY - p.y) / scale;
      }
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 2 && pinchStart) {
        const [a, b] = [...pointers.values()];
        zoom = Math.min(4, Math.max(1, (pinchStart.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinchStart.d));
        range.value = String(zoom);
      }
      layout();
    });
    const release = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = null;
    };
    view.addEventListener('pointerup', release);
    view.addEventListener('pointercancel', release);

    const finish = (value) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      s.close();
      resolve(value);
    };

    const s = sheet(
      h('div', { class: 'stack' },
        h('p', { class: 'muted center-text' }, 'Déplacez l’image et zoomez pour cadrer le logo.'),
        view,
        h('label', { class: 'zoom-row' }, '🔍', range),
        h('div', { class: 'row gap' },
          h('button', { class: 'btn ghost grow', onclick: () => finish(null) }, 'Annuler'),
          h('button', { class: 'btn primary grow', onclick: () => {
            clamp();
            const sd = side();
            finish(renderSquare(img, { sx: cx - sd / 2, sy: cy - sd / 2, side: sd }));
          } }, 'Utiliser'))),
      { title: 'Recadrer le logo', onClose: () => finish(null) },
    );
    requestAnimationFrame(layout);
    setTimeout(layout, 250);
  });
}
