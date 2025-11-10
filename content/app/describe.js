/**
 * Produces a human-friendly description of the selected element.
 * @param {Element} element
 * @returns {{ tag: string; text: string; classes: string }}
 */
export function describeElement(element) {
  const text = (element.textContent || '').trim().slice(0, 80);
  const classes = (element.className || '')
    .toString()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join('.');
  return {
    tag: element.tagName.toLowerCase(),
    text,
    classes,
  };
}

