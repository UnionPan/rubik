import { createContext } from 'react';

/**
 * explainAll: whether "Why?" explanations start open.
 * version:    bumps whenever the global switch is flipped, which resets every
 *             section's individual override.
 */
export const ExplainContext = createContext({ explainAll: false, version: 0 });

const STORAGE_KEY = 'rubik.explain';

export function readExplainPreference() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeExplainPreference(on) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    // storage unavailable - the preference just isn't remembered
  }
}
