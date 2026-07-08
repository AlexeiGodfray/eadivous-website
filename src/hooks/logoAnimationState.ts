import logoFrozenUrl from '../assets/logo-frozen.png';

/** One full GIF playthrough — loops back to a dot after this. */
export const LOGO_GIF_DURATION_MS = 2_280;
/** Freeze just before the loop restarts. */
const LOGO_GIF_FREEZE_MS = LOGO_GIF_DURATION_MS - 30;

export const logoFrozenAssetUrl = logoFrozenUrl;

// Decode the still frame early so the swap never flashes.
const stillPreload = new Image();
stillPreload.decoding = 'async';
stillPreload.src = logoFrozenUrl;

let frozen = false;
let playTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

export function isLogoFrozen(): boolean {
  return frozen;
}

function notifyFrozen(): void {
  for (const listener of listeners) listener();
}

export function subscribeLogoFreeze(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startLogoPlayback(onFreeze: () => void): () => void {
  if (frozen) {
    onFreeze();
    return () => {};
  }

  const unsubscribe = subscribeLogoFreeze(onFreeze);

  if (!playTimer) {
    playTimer = setTimeout(() => {
      playTimer = null;
      frozen = true;
      notifyFrozen();
    }, LOGO_GIF_FREEZE_MS);
  }

  return unsubscribe;
}
