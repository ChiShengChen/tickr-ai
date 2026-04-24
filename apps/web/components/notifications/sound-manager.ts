'use client';

// Thin wrapper around Howler so we can unlock audio during onboarding (required
// by autoplay policies) and replay the same cue on every signal.

import { Howl } from 'howler';

let howl: Howl | null = null;
let unlocked = false;

function getHowl(): Howl {
  if (howl) return howl;
  howl = new Howl({
    src: ['/sounds/signal.mp3'],
    volume: 0.6,
    preload: true,
    html5: false,
  });
  return howl;
}

export function unlockSound(): void {
  if (unlocked) return;
  const h = getHowl();
  // Firing play immediately inside a user gesture flips the audio context
  // into a running state even if the file errors (we swallow).
  try {
    const id = h.play();
    h.volume(0, id);
    h.once('play', () => h.stop(id));
  } catch {
    /* noop */
  }
  unlocked = true;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('signaldesk.soundUnlocked', '1');
    } catch {
      /* noop */
    }
  }
}

export function isSoundUnlocked(): boolean {
  if (unlocked) return true;
  if (typeof window === 'undefined') return false;
  try {
    unlocked = window.localStorage.getItem('signaldesk.soundUnlocked') === '1';
  } catch {
    /* noop */
  }
  return unlocked;
}

export function playSignalSound(volume = 0.6): void {
  if (!isSoundUnlocked()) return;
  const h = getHowl();
  const id = h.play();
  h.volume(volume, id);
}
