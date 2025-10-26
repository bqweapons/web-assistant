export function cloneMessages(value) {
  return JSON.parse(JSON.stringify(value));
}

export function mergeMessages(target, source) {
  Object.keys(source).forEach((key) => {
    const entry = source[key];
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      mergeMessages(target[key], entry);
    } else {
      target[key] = entry;
    }
  });
}
