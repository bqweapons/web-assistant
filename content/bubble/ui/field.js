const FOCUS_BORDER_COLOR = '#2563eb';
const FOCUS_BOX_SHADOW = '0 0 0 3px rgba(37, 99, 235, 0.12)';
const DEFAULT_BORDER_COLOR = 'rgba(148, 163, 184, 0.6)';
const DEFAULT_BACKGROUND = 'rgba(241, 245, 249, 0.6)';

/**
 * Creates a form field wrapper with label and optional control.
 * @param {string} labelText
 * @param {HTMLElement | null} [control]
 * @returns {{ wrapper: HTMLLabelElement, label: HTMLSpanElement }}
 */
export function createField(labelText, control = null) {
  const wrapper = document.createElement('label');
  Object.assign(wrapper.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontWeight: '500',
    color: '#0f172a',
  });

  const label = document.createElement('span');
  label.textContent = labelText;
  Object.assign(label.style, {
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: '#64748b',
  });

  wrapper.appendChild(label);
  if (control) {
    wrapper.appendChild(control);
  }

  return { wrapper, label };
}

/**
 * Applies shared input styling to a form control.
 * @param {HTMLElement & { style: CSSStyleDeclaration }} element
 */
export function styleInput(element) {
  Object.assign(element.style, {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '10px',
    border: `1px solid ${DEFAULT_BORDER_COLOR}`,
    backgroundColor: DEFAULT_BACKGROUND,
    fontSize: '13px',
    color: '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
  });

  element.addEventListener('focus', () => {
    element.style.borderColor = FOCUS_BORDER_COLOR;
    element.style.backgroundColor = '#ffffff';
    element.style.boxShadow = FOCUS_BOX_SHADOW;
  });

  element.addEventListener('blur', () => {
    element.style.borderColor = DEFAULT_BORDER_COLOR;
    element.style.backgroundColor = DEFAULT_BACKGROUND;
    element.style.boxShadow = 'none';
  });
}

/**
 * Creates a section container with title and optional description.
 * @param {string} titleText
 * @param {string} [descriptionText]
 * @returns {{ section: HTMLElement, content: HTMLElement }}
 */
export function createSection(titleText, descriptionText = '') {
  const section = document.createElement('section');
  Object.assign(section.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '14px',
    borderRadius: '14px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
  });

  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  });

  const title = document.createElement('h4');
  title.textContent = titleText;
  Object.assign(title.style, {
    margin: '0',
    fontSize: '13px',
    fontWeight: '600',
    color: '#0f172a',
  });
  header.appendChild(title);

  if (descriptionText) {
    const description = document.createElement('p');
    description.textContent = descriptionText;
    Object.assign(description.style, {
      margin: '0',
      fontSize: '12px',
      color: '#64748b',
      lineHeight: '1.5',
    });
    header.appendChild(description);
  }

  const content = document.createElement('div');
  Object.assign(content.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  });

  section.append(header, content);
  return { section, content };
}
