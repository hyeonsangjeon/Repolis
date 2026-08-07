const PALETTES = Object.freeze([
  Object.freeze({ name: 'harbor', primary: '#173d55', deep: '#102536', accent: '#f2b84b', paper: '#f7efdf', ink: '#17232b' }),
  Object.freeze({ name: 'terracotta', primary: '#7d3f32', deep: '#3d2523', accent: '#f0c36c', paper: '#fbefdc', ink: '#2f211d' }),
  Object.freeze({ name: 'garden', primary: '#2f5b4d', deep: '#18372f', accent: '#e9b95f', paper: '#f2edda', ink: '#1d2b25' }),
  Object.freeze({ name: 'indigo', primary: '#343b73', deep: '#1d2247', accent: '#e7bd65', paper: '#f4ecdf', ink: '#20233b' }),
  Object.freeze({ name: 'plum', primary: '#67405d', deep: '#352437', accent: '#edbd72', paper: '#f8ecdf', ink: '#32212e' }),
  Object.freeze({ name: 'slate', primary: '#365464', deep: '#1b3039', accent: '#e9b665', paper: '#f4eddf', ink: '#1d2b31' })
]);

export const POSTCARD_FORMATS = Object.freeze({
  landscape: Object.freeze({ id: 'landscape', width: 1600, height: 1000, bandTop: 610 }),
  portrait: Object.freeze({ id: 'portrait', width: 1200, height: 1500, bandTop: 930 })
});

export function hashPostcardSeed(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function publicRepoIdentity(repo) {
  return [
    String(repo?.repo || ''),
    String(repo?.lang || ''),
    Math.max(0, Number(repo?.stars) || 0),
    Math.max(0, Number(repo?.forks) || 0)
  ].join(':');
}

export function createTownPostcardIdentity(user, repos = []) {
  const normalizedUser = String(user || '').trim().toLowerCase();
  const userHash = hashPostcardSeed(normalizedUser);
  const repoSignal = repos.map(publicRepoIdentity).sort().join('|');
  const metadataHash = hashPostcardSeed(normalizedUser + '|' + repoSignal);
  const letters = normalizedUser.replace(/[^a-z0-9]/g, '').slice(0, 2).toUpperCase() || 'RP';
  return Object.freeze({
    hash: metadataHash,
    paletteIndex: userHash % PALETTES.length,
    palette: PALETTES[userHash % PALETTES.length],
    letters,
    spokes: 6 + (metadataHash % 5),
    rings: 2 + ((metadataHash >>> 5) % 2),
    notch: 3 + ((metadataHash >>> 9) % 5)
  });
}

export function summarizeTownRepos(repos = []) {
  const languages = new Map();
  for (const repo of repos) {
    const language = String(repo?.lang || '').trim();
    if (!language || language === 'Other' || language === '\u2014') continue;
    languages.set(language, (languages.get(language) || 0) + 1);
  }
  const languageItems = [...languages.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name))
    .slice(0, 3);
  if (languageItems.length) return { type: 'languages', items: languageItems };

  const repoItems = repos.slice()
    .sort((a, b) => ((Number(b?.stars) || 0) - (Number(a?.stars) || 0))
      || ((Number(b?.forks) || 0) - (Number(a?.forks) || 0))
      || String(a?.repo || '').localeCompare(String(b?.repo || '')))
    .slice(0, 3)
    .map(repo => ({ name: String(repo?.repo || ''), count: Math.max(0, Number(repo?.stars) || 0) }))
    .filter(item => item.name);
  return { type: repoItems.length ? 'repos' : 'empty', items: repoItems };
}

export function postcardFormatForViewport(width, height) {
  return Number(height) > Number(width) * 1.18 ? POSTCARD_FORMATS.portrait : POSTCARD_FORMATS.landscape;
}

export function postcardCaptureSize(width, height, maxPixels = 1800000, maxEdge = 1600) {
  const sourceWidth = Math.max(1, Number(width) || 1);
  const sourceHeight = Math.max(1, Number(height) || 1);
  const pixelLimit = Math.max(1, Number(maxPixels) || 1);
  const edgeLimit = Math.max(1, Number(maxEdge) || 1);
  const scale = Math.min(
    edgeLimit / Math.max(sourceWidth, sourceHeight),
    Math.sqrt(pixelLimit / (sourceWidth * sourceHeight))
  );
  const captureWidth = Math.max(1, Math.floor(sourceWidth * scale));
  const captureHeight = Math.max(1, Math.floor(sourceHeight * scale));
  return {
    width: captureWidth,
    height: captureHeight,
    pixels: captureWidth * captureHeight
  };
}

export function analyzeTownFrame(pixels, width, height) {
  const total = Math.max(1, Math.floor(Number(width) * Number(height)));
  const stride = Math.max(1, Math.floor(total / 16000));
  let samples = 0, opaque = 0, minLuma = 255, maxLuma = 0, sum = 0;
  for (let pixel = 0; pixel < total; pixel += stride) {
    const index = pixel * 4;
    const alpha = pixels[index + 3] || 0;
    const luma = Math.round((pixels[index] || 0) * 0.2126 + (pixels[index + 1] || 0) * 0.7152 + (pixels[index + 2] || 0) * 0.0722);
    samples++;
    if (alpha > 8) opaque++;
    minLuma = Math.min(minLuma, luma);
    maxLuma = Math.max(maxLuma, luma);
    sum += luma;
  }
  const opaqueRatio = opaque / Math.max(1, samples);
  const spread = maxLuma - minLuma;
  return {
    samples,
    opaqueRatio,
    minLuma,
    maxLuma,
    meanLuma: sum / Math.max(1, samples),
    spread,
    blank: opaqueRatio < 0.5 || spread < 6
  };
}

export function flipPixelRows(pixels, width, height) {
  const rowBytes = width * 4;
  const row = new Uint8Array(rowBytes);
  for (let y = 0; y < Math.floor(height / 2); y++) {
    const top = y * rowBytes;
    const bottom = (height - y - 1) * rowBytes;
    row.set(pixels.subarray(top, top + rowBytes));
    pixels.copyWithin(top, bottom, bottom + rowBytes);
    pixels.set(row, bottom);
  }
  return pixels;
}

function roundedPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawCover(ctx, source, width, height) {
  const sourceRatio = source.width / source.height;
  const targetRatio = width / height;
  let sx = 0, sy = 0, sw = source.width, sh = source.height;
  if (sourceRatio > targetRatio) {
    sw = source.height * targetRatio;
    sx = (source.width - sw) / 2;
  } else {
    sh = source.width / targetRatio;
    sy = (source.height - sh) * 0.43;
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
}

function fittedFont(ctx, text, maxWidth, startSize, minSize, weight = 700, family = 'system-ui, sans-serif') {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > minSize);
  return size;
}

function drawSeal(ctx, identity, x, y, radius) {
  const { palette } = identity;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = palette.paper;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = Math.max(5, radius * 0.055);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (let ring = 1; ring <= identity.rings; ring++) {
    ctx.globalAlpha = 0.36 + ring * 0.12;
    ctx.lineWidth = Math.max(2, radius * 0.018);
    ctx.beginPath();
    ctx.arc(0, 0, radius * (0.62 - ring * 0.11), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = Math.max(3, radius * 0.03);
  for (let i = 0; i < identity.spokes; i++) {
    const angle = (i / identity.spokes) * Math.PI * 2;
    const inner = radius * 0.48;
    const outer = radius * (0.72 + (i % identity.notch === 0 ? 0.09 : 0));
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.primary;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.paper;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(radius * 0.34)}px system-ui, sans-serif`;
  ctx.fillText(identity.letters, 0, radius * 0.02);
  ctx.restore();
}

export function composeTownPostcard(options) {
  const {
    canvas, sourceCanvas, format, identity, kicker, title, repoLine,
    signature, shareUrl, madeWith
  } = options;
  const width = format.width, height = format.height;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('postcard-2d-context');
  const { palette } = identity;

  ctx.fillStyle = palette.primary;
  ctx.fillRect(0, 0, width, height);
  drawCover(ctx, sourceCanvas, width, height);

  const wash = ctx.createLinearGradient(0, format.bandTop - 130, 0, height);
  wash.addColorStop(0, 'rgba(0,0,0,0)');
  wash.addColorStop(0.24, palette.deep + 'cc');
  wash.addColorStop(1, palette.deep);
  ctx.fillStyle = wash;
  ctx.fillRect(0, format.bandTop - 130, width, height - format.bandTop + 130);

  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = format.id === 'portrait' ? 22 : 24;
  ctx.strokeRect(18, 18, width - 36, height - 36);

  const portrait = format.id === 'portrait';
  const pad = portrait ? 58 : 64;
  const sealRadius = portrait ? 100 : 94;
  const sealX = pad + sealRadius;
  const sealY = format.bandTop + (height - format.bandTop) * 0.45;
  drawSeal(ctx, identity, sealX, sealY, sealRadius);

  const textX = sealX + sealRadius + (portrait ? 42 : 48);
  const textWidth = width - textX - pad;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = palette.accent;
  ctx.font = `800 ${portrait ? 27 : 25}px system-ui, sans-serif`;
  ctx.fillText(String(kicker || '').toUpperCase(), textX, format.bandTop + (portrait ? 66 : 58));

  ctx.fillStyle = palette.paper;
  fittedFont(ctx, String(title || ''), textWidth, portrait ? 58 : 56, 34, 800);
  ctx.fillText(String(title || ''), textX, format.bandTop + (portrait ? 137 : 126));

  ctx.globalAlpha = 0.9;
  fittedFont(ctx, String(repoLine || ''), textWidth, portrait ? 30 : 28, 21, 700);
  ctx.fillText(String(repoLine || ''), textX, format.bandTop + (portrait ? 196 : 180));

  ctx.globalAlpha = 0.78;
  fittedFont(ctx, String(signature || ''), textWidth, portrait ? 27 : 25, 19, 600);
  ctx.fillText(String(signature || ''), textX, format.bandTop + (portrait ? 245 : 226));

  ctx.globalAlpha = 0.72;
  ctx.fillStyle = palette.paper;
  ctx.font = `600 ${portrait ? 24 : 22}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  fittedFont(ctx, String(shareUrl || ''), width - pad * 2 - 260, portrait ? 24 : 22, 16, 600, 'ui-monospace, SFMono-Regular, Menlo, monospace');
  ctx.fillText(String(shareUrl || ''), pad, height - (portrait ? 58 : 52));

  ctx.textAlign = 'right';
  ctx.font = `700 ${portrait ? 24 : 22}px system-ui, sans-serif`;
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = 0.84;
  ctx.fillText(String(madeWith || ''), width - pad, height - (portrait ? 58 : 52));
  ctx.globalAlpha = 1;

  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.3;
  roundedPath(ctx, pad - 18, format.bandTop + 22, width - pad * 2 + 36, height - format.bandTop - 105, 28);
  ctx.stroke();
  ctx.globalAlpha = 1;

  return { width, height, orientation: format.id, identityHash: identity.hash, palette: identity.palette.name };
}

export function postcardCanvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('postcard-png-empty')), 'image/png');
    } catch (error) {
      reject(error);
    }
  });
}
