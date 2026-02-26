function getMessage(key, fallback) {
  try {
    if (chrome?.i18n?.getMessage) {
      const msg = chrome.i18n.getMessage(key);
      if (msg) return msg;
    }
  } catch (_error) {
    // ignore
  }
  return fallback || key;
}

export { getMessage };
