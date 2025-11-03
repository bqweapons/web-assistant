export function sanitizeUrl(href) {
  if (!href) {
    return null;
  }
  try {
    const url = new URL(href, window.location.href);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
      return url.href;
    }
    return null;
  } catch (_error) {
    return null;
  }
}

export function resolveSelector(selector) {
  try {
    return document.querySelector(selector);
  } catch (_error) {
    return null;
  }
}

export function kebabCase(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export function delay(ms) {
  const duration = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return new Promise((resolve) => setTimeout(resolve, duration));
}

export function forwardClick(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  const rect = target.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  const baseInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    button: 0,
    clientX,
    clientY,
  };
  const pointerInit = {
    ...baseInit,
    pointerType: 'mouse',
    isPrimary: true,
  };
  let triggered = false;
  const dispatch = (factory) => {
    try {
      const event = factory();
      target.dispatchEvent(event);
      triggered = true;
    } catch (_error) {
      // ignore failures and continue with other events
    }
  };
  if (typeof PointerEvent === 'function') {
    dispatch(() => new PointerEvent('pointerdown', pointerInit));
  }
  dispatch(() => new MouseEvent('mousedown', baseInit));
  if (typeof PointerEvent === 'function') {
    dispatch(() => new PointerEvent('pointerup', pointerInit));
  }
  dispatch(() => new MouseEvent('mouseup', baseInit));
  dispatch(() => new MouseEvent('click', baseInit));
  if (typeof target.click === 'function') {
    try {
      target.click();
      triggered = true;
    } catch (_error) {
      // native click failed; continue
    }
  }
  return triggered;
}


