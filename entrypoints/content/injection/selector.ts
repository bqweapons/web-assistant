const cssEscapeImpl =
  typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape.bind(CSS)
    : (value: string) => String(value).replace(/[^a-zA-Z0-9_\-]/g, (char) => `\\${char}`);

export const cssEscape = (value: string) => cssEscapeImpl(value);

const isIdUnique = (id: string, contextDocument: Document) => {
  try {
    return contextDocument.querySelectorAll(`#${cssEscape(id)}`).length === 1;
  } catch {
    return false;
  }
};

const nthOfType = (element: Element) => {
  const parent = element.parentElement;
  if (!parent) {
    return 1;
  }
  const siblings = Array.from(parent.children).filter((node) => node.localName === element.localName);
  return siblings.indexOf(element) + 1;
};

export const generateSelector = (element: Element) => {
  const contextDocument = element.ownerDocument || document;
  if (element.id && isIdUnique(element.id, contextDocument)) {
    return `#${cssEscape(element.id)}`;
  }
  const segments: string[] = [];
  let current: Element | null = element;
  while (current && current.nodeType === Node.ELEMENT_NODE && current !== contextDocument.documentElement) {
    let segment = current.localName;
    if (!segment) {
      break;
    }
    if (current.id && isIdUnique(current.id, current.ownerDocument || contextDocument)) {
      segment = `${segment}#${cssEscape(current.id)}`;
      segments.unshift(segment);
      break;
    }
    const nth = nthOfType(current);
    if (nth > 1) {
      segment += `:nth-of-type(${nth})`;
    }
    segments.unshift(segment);
    current = current.parentElement;
  }
  return segments.join(' > ');
};

export const selectorForSibling = (node: Element | null) => {
  if (!node) {
    return undefined;
  }
  try {
    const selector = generateSelector(node);
    return selector || undefined;
  } catch {
    return undefined;
  }
};
