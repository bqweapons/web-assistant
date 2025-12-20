const HUD_ID = 'page-augmentor-hud';

function ensureHudRoot() {
  let root = document.getElementById(HUD_ID);
  if (root) {
    return root;
  }
  root = document.createElement('div');
  root.id = HUD_ID;
  root.style.position = 'fixed';
  root.style.top = '16px';
  root.style.right = '16px';
  root.style.zIndex = '2147483647';
  root.style.pointerEvents = 'none';
  document.documentElement.appendChild(root);
  return root;
}

function createCard(text, variant = 'info') {
  const card = document.createElement('div');
  card.style.maxWidth = '320px';
  card.style.marginTop = '8px';
  card.style.padding = '12px 14px';
  card.style.borderRadius = '12px';
  card.style.border = '1px solid rgba(148, 163, 184, 0.6)';
  card.style.boxShadow = '0 12px 30px rgba(15, 23, 42, 0.18)';
  card.style.background = '#fff';
  card.style.color = '#0f172a';
  card.style.fontSize = '13px';
  card.style.lineHeight = '1.4';
  card.style.pointerEvents = 'auto';
  card.dataset.variant = variant;

  if (variant === 'error') {
    card.style.border = '1px solid rgba(248, 113, 113, 0.35)';
    card.style.background = '#fef2f2';
    card.style.color = '#991b1b';
  } else if (variant === 'warning') {
    card.style.border = '1px solid rgba(251, 191, 36, 0.4)';
    card.style.background = '#fffbeb';
    card.style.color = '#92400e';
  }

  const textNode = document.createElement('div');
  textNode.textContent = text;
  card.appendChild(textNode);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '6px';
  closeBtn.style.right = '8px';
  closeBtn.style.border = 'none';
  closeBtn.style.background = 'transparent';
  closeBtn.style.color = 'inherit';
  closeBtn.style.fontSize = '14px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.addEventListener('click', () => {
    card.remove();
  });
  card.appendChild(closeBtn);

  return card;
}

/**
 * Displays a transient HUD message on the page.
 * @param {string} message
 * @param {'info' | 'error' | 'warning'} [variant]
 */
export function showHUD(message, variant = 'info') {
  if (!message) return;
  const root = ensureHudRoot();
  const card = createCard(message, variant);
  root.appendChild(card);
  window.setTimeout(() => {
    card.style.opacity = '0';
    card.style.transition = 'opacity 150ms ease';
    window.setTimeout(() => card.remove(), 200);
  }, 4500);
}
