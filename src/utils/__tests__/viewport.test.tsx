import { act, renderHook } from '@testing-library/react';

import { NARROW_VIEWPORT_MAX, useNarrowViewport } from '../viewport';

type Listener = () => void;

function mockMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();

  window.matchMedia = jest.fn().mockImplementation(() => ({
    get matches() {
      return matches;
    },
    addEventListener: (_: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;

  return (next: boolean) => {
    matches = next;
    listeners.forEach((listener) => listener());
  };
}

describe('useNarrowViewport', () => {
  const original = window.matchMedia;

  afterEach(() => {
    window.matchMedia = original;
  });

  it('uses the phone breakpoint', () => {
    expect(NARROW_VIEWPORT_MAX).toBe(768);
  });

  it('reports the current width and follows resizes', () => {
    const setMatches = mockMatchMedia(false);
    const { result } = renderHook(() => useNarrowViewport());

    expect(result.current).toBe(false);
    act(() => setMatches(true));
    expect(result.current).toBe(true);
    act(() => setMatches(false));
    expect(result.current).toBe(false);
  });

  it('is false where matchMedia does not exist', () => {
    // @ts-expect-error simulating an environment without matchMedia
    delete window.matchMedia;
    const { result } = renderHook(() => useNarrowViewport());

    expect(result.current).toBe(false);
  });
});
