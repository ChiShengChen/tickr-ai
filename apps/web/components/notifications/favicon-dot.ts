'use client';

/**
 * Draws a red dot over the current favicon and swaps it onto the <link rel="icon"> tag,
 * so that background tabs get a visual "unread" marker in the tab bar.
 *
 * No favicon file is needed in /public — we draw one from scratch. If an
 * <link rel="icon"> already exists we swap its href; otherwise we append one.
 */

let originalHref: string | null = null;

function ensureLink(): HTMLLinkElement | null {
  if (typeof document === 'undefined') return null;
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  return link;
}

function drawAlertFavicon(): string {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  // Base tile (dark panel)
  ctx.fillStyle = '#12151d';
  ctx.fillRect(0, 0, size, size);
  // Accent mark (Hunch It badge)
  ctx.fillStyle = '#a089ff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', size / 2, size / 2 + 1);
  // Red dot in corner
  ctx.beginPath();
  ctx.fillStyle = '#ef4444';
  ctx.arc(size - 7, 7, 6, 0, Math.PI * 2);
  ctx.fill();
  return canvas.toDataURL('image/png');
}

export function setAlertFavicon(): void {
  const link = ensureLink();
  if (!link) return;
  if (originalHref === null) originalHref = link.href;
  link.href = drawAlertFavicon();
}

export function clearAlertFavicon(): void {
  const link = ensureLink();
  if (!link) return;
  if (originalHref !== null) link.href = originalHref;
  originalHref = null;
}
