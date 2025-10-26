/**
 * Normalizes the editable style map by trimming values and dropping empties.
 * @param {Record<string, string>} styleState
 * @param {() => Array<{ name: string }>} getStyleFieldConfigs
 * @returns {Record<string, string> | undefined}
 */
export function normalizeStyleState(styleState, getStyleFieldConfigs) {
  const entries = {};
  const configs = typeof getStyleFieldConfigs === 'function' ? getStyleFieldConfigs() : [];

  configs.forEach(({ name }) => {
    const value = typeof styleState[name] === 'string' ? styleState[name].trim() : '';
    if (value) {
      entries[name] = value;
    }
  });

  return Object.keys(entries).length ? entries : undefined;
}
