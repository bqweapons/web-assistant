import { runtime } from './context.js';

export function matchesFrameSelectors(candidate) {
  const selectors = Array.isArray(candidate) ? candidate : [];
  const frameContext = runtime.frameContext || { sameOriginWithTop: false, frameSelectors: [] };
  if (!frameContext.sameOriginWithTop) {
    return selectors.length === 0;
  }
  if (selectors.length !== frameContext.frameSelectors.length) {
    return false;
  }
  return selectors.every((value, index) => value === frameContext.frameSelectors[index]);
}

export function elementMatchesFrame(element) {
  return element ? matchesFrameSelectors(element.frameSelectors) : false;
}

