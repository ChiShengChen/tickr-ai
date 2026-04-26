'use client';

// Swaps `document.title` between the original and an alert string on an
// interval, stopping when the tab regains focus.

let originalTitle: string | null = null;
let handle: ReturnType<typeof setInterval> | null = null;
let focusHandler: (() => void) | null = null;

export function startTitleFlash(alertTitle: string, intervalMs = 900): void {
  if (typeof document === 'undefined') return;
  if (handle) return;
  originalTitle ??= document.title;
  let alt = true;
  handle = setInterval(() => {
    document.title = alt ? alertTitle : (originalTitle ?? 'Hunch It');
    alt = !alt;
  }, intervalMs);
  focusHandler = () => stopTitleFlash();
  window.addEventListener('focus', focusHandler, { once: true });
  document.addEventListener('visibilitychange', onVisibility);
}

function onVisibility() {
  if (!document.hidden) stopTitleFlash();
}

export function stopTitleFlash(): void {
  if (handle) {
    clearInterval(handle);
    handle = null;
  }
  if (focusHandler) {
    window.removeEventListener('focus', focusHandler);
    focusHandler = null;
  }
  document.removeEventListener('visibilitychange', onVisibility);
  if (originalTitle !== null) {
    document.title = originalTitle;
  }
}
