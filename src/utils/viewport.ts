import { useSyncExternalStore } from 'react';

/** At or below this width the sidebar becomes an overlay and headers drop to the essentials (phones, small tablets). */
export const NARROW_VIEWPORT_MAX = 768;

const QUERY = `(max-width: ${NARROW_VIEWPORT_MAX}px)`;

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;

  const media = window.matchMedia(QUERY);

  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function snapshot() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

/** True while the window is a phone-sized one; follows resizes and rotation. */
export function useNarrowViewport() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
