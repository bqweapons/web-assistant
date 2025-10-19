import { sendMessage, MessageType } from '../common/messaging.js';
import { getActiveTab } from '../common/compat.js';

const state = {
  items: /** @type {import('../common/types.js').InjectedElement[]} */ ([]),
  filterText: '',
  filterType: /** @type {'all' | 'button' | 'link'} */ ('all'),
  selectedId: /** @type {string | null} */ (null),
  pageUrl: '',
  tabId: /** @type {number | undefined} */ (undefined),
  pendingPicker: /** @type {'creator' | 'editor' | null} */ (null),
};

const elements = {
  list: /** @type {HTMLElement} */ (document.querySelector('[data-role="list"]')),
  search: /** @type {HTMLInputElement} */ (document.querySelector('[data-role="search"]')),
  typeFilter: /** @type {HTMLSelectElement} */ (document.querySelector('[data-role="type-filter"]')),
  context: /** @type {HTMLElement} */ (document.querySelector('[data-role="context"]')),
  creatorSection: /** @type {HTMLElement} */ (document.querySelector('.sp-create')),
  creatorForm: /** @type {HTMLFormElement} */ (document.querySelector('[data-role="creator"]')),
  creatorMessage: /** @type {HTMLElement} */ (document.querySelector('[data-role="creator-message"]')),
  detail: /** @type {HTMLElement} */ (document.querySelector('[data-role="detail"]')),
  editor: /** @type {HTMLFormElement} */ (document.querySelector('[data-role="editor"]')),
  message: /** @type {HTMLElement} */ (document.querySelector('[data-role="message"]')),
  hrefField: /** @type {HTMLElement} */ (document.querySelector('[data-role="href-field"]')),
  typeLabel: /** @type {HTMLElement} */ (document.querySelector('[data-role="type-label"]')),
};

init().catch((error) => {
  console.error('[PageAugmentor] Side panel failed to initialize', error);
  showMessage(`Initialization error: ${error.message}`);
});

/**
 * Initializes the side panel by loading context, binding events, and rendering data.
 * @returns {Promise<void>}
 */
async function init() {
  bindControlEvents();
  await hydrateContext();
  await refreshItems();
  registerMessageListener();
}

/**
 * Registers UI event listeners.
 */
function bindControlEvents() {
  elements.search.addEventListener('input', (event) => {
    state.filterText = (event.target.value || '').toString();
    renderList();
  });

  elements.creatorForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await handleCreatorSubmit();
  });

  const creatorTypeField = elements.creatorForm?.elements.namedItem('type');
  if (creatorTypeField instanceof HTMLSelectElement) {
    creatorTypeField.addEventListener('change', () => updateCreatorHrefVisibility());
    updateCreatorHrefVisibility();
  }

  elements.creatorForm?.querySelector('[data-action="reset-creator"]')?.addEventListener('click', () =>
    resetCreatorForm(),
  );

  document.querySelectorAll('[data-action="pick-target"]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!(button instanceof HTMLElement)) {
        return;
      }
      const form = button.dataset.form;
      if (form === 'creator') {
        requestPicker('creator');
      } else if (form === 'editor') {
        requestPicker('editor');
      }
    });
  });

  document.querySelector('[data-action="open-overview"]')?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('overview/overview.html') });
  });

  elements.typeFilter.addEventListener('change', (event) => {
    state.filterType = /** @type {'all' | 'button' | 'link'} */ (event.target.value);
    renderList();
  });

  elements.list.addEventListener('click', handleListClick);

  elements.editor.addEventListener('submit', async (event) => {
    event.preventDefault();
    await handleEditorSubmit();
  });

  elements.editor.querySelector('[data-action="cancel-edit"]')?.addEventListener('click', () => {
    closeEditor();
  });
}

/**
 * Fetches the active tab and updates context metadata.
 * @returns {Promise<void>}
 */
async function hydrateContext() {
  const tab = await getActiveTab();
  if (!tab || !tab.url) {
    elements.context.textContent = 'No active tab detected.';
    return;
  }
  state.tabId = tab.id;
  state.pageUrl = normalizeUrl(tab.url);
  elements.context.textContent = state.pageUrl;
}

/**
 * Requests element metadata from the background script.
 * @returns {Promise<void>}
 */
async function refreshItems() {
  if (!state.pageUrl) {
    state.items = [];
    renderList();
    return;
  }
  try {
    const items = await sendMessage(MessageType.LIST_BY_URL, { pageUrl: state.pageUrl });
    state.items = Array.isArray(items) ? items : [];
    renderList();
  } catch (error) {
    showMessage(`Failed to load elements: ${error.message}`);
  }
}

/**
 * Toggles the URL field for the creator form based on type selection.
 */
function updateCreatorHrefVisibility() {
  const typeField = elements.creatorForm?.elements.namedItem('type');
  if (!(typeField instanceof HTMLSelectElement)) {
    return;
  }
  const hrefInput = elements.creatorForm?.elements.namedItem('href');
  if (hrefInput instanceof HTMLInputElement) {
    const isLink = typeField.value === 'link';
    hrefInput.required = isLink;
    hrefInput.placeholder = isLink ? 'https://example.com' : 'https://example.com (可选)';
  }
}

/**
 * Clears the creator form state.
 */
function resetCreatorForm() {
  if (!elements.creatorForm) {
    return;
  }
  cancelPickerFor('creator');
  elements.creatorForm.reset();
  const selectorField = elements.creatorForm.elements.namedItem('selector');
  if (selectorField instanceof HTMLInputElement) {
    selectorField.value = '';
  }
  const positioningField = elements.creatorForm.elements.namedItem('positioning');
  if (positioningField instanceof HTMLSelectElement) {
    positioningField.value = '';
  }
  updateCreatorHrefVisibility();
  showCreatorMessage('');
  state.pendingPicker = null;
}

/**
 * Handles creation form submission.
 * @returns {Promise<void>}
 */
async function handleCreatorSubmit() {
  if (!elements.creatorForm) {
    return;
  }
  if (!state.pageUrl) {
    showCreatorMessage('未检测到活动页面。');
    return;
  }
  const payload = buildPayloadFromCreator();
  if (!payload.selector) {
    showCreatorMessage('请先拾取页面元素。');
    return;
  }
  if (payload.type === 'link' && !payload.href) {
    showCreatorMessage('请提供有效的链接 URL。');
    return;
  }
  const hrefInput = elements.creatorForm.elements.namedItem('href');
  const rawHref = hrefInput instanceof HTMLInputElement ? hrefInput.value.trim() : '';
  if (payload.type === 'button' && rawHref && !payload.href) {
    showCreatorMessage('请输入合法的 URL（例如 https://example.com）。');
    return;
  }
  try {
    const items = await sendMessage(MessageType.CREATE, payload);
    state.items = Array.isArray(items) ? items : [];
    renderList();
    showCreatorMessage('元素已保存。');
    resetCreatorForm();
  } catch (error) {
    showCreatorMessage(`保存失败：${error.message}`);
  }
}

/**
 * Builds payload for element creation from the creator form.
 * @returns {import('../common/types.js').InjectedElement}
 */
function buildPayloadFromCreator() {
  const formData = new FormData(elements.creatorForm);
  const type = /** @type {'button' | 'link'} */ (formData.get('type') || 'button');
  const style = collectStyle(formData);
  const rawHref = (formData.get('href') || '').toString().trim();
  const sanitizedHref = rawHref ? sanitizeUrl(rawHref) : undefined;
  return {
    id: crypto.randomUUID(),
    pageUrl: state.pageUrl,
    type,
    text: (formData.get('text') || '').toString().trim(),
    href: sanitizedHref,
    selector: (formData.get('selector') || '').toString().trim(),
    position: /** @type {'append' | 'prepend' | 'before' | 'after'} */ (formData.get('position') || 'append'),
    style,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Requests the content script to start element picker.
 * @param {'creator' | 'editor'} form
 */
async function requestPicker(form) {
  await cancelActivePicker();
  if (form === 'editor' && !state.selectedId) {
    showMessage('请先选择一个元素再重新拾取目标。');
    return;
  }
  if (!state.pageUrl) {
    if (form === 'creator') {
      showCreatorMessage('当前没有对应的页面 URL。');
    } else {
      showMessage('当前没有对应的页面 URL。');
    }
    return;
  }
  if (!state.tabId) {
    if (form === 'creator') {
      showCreatorMessage('未找到活动标签页，无法拾取元素。');
    } else {
      showMessage('未找到活动标签页，无法拾取元素。');
    }
    return;
  }
  state.pendingPicker = form;
  if (form === 'creator') {
    showCreatorMessage('请在网页上点击目标元素。');
  } else {
    showMessage('请在网页上点击新的目标元素。');
  }
  try {
    await sendMessage(MessageType.START_PICKER, { tabId: state.tabId, pageUrl: state.pageUrl });
  } catch (error) {
    if (form === 'creator') {
      showCreatorMessage(`无法启动拾取：${error.message}`);
    } else {
      showMessage(`无法启动拾取：${error.message}`);
    }
    state.pendingPicker = null;
  }
}

/**
 * Cancels the active picker session when necessary.
 * @param {'creator' | 'editor'} form
 */
async function cancelPickerFor(form) {
  if (state.pendingPicker !== form) {
    return;
  }
  const tabId = state.tabId;
  const pageUrl = state.pageUrl;
  state.pendingPicker = null;
  if (!tabId || !pageUrl) {
    return;
  }
  try {
    await sendMessage(MessageType.CANCEL_PICKER, { tabId, pageUrl });
  } catch (error) {
    console.warn('Failed to cancel picker:', error);
  }
}

async function cancelActivePicker() {
  if (!state.pendingPicker) {
    return;
  }
  await cancelPickerFor(state.pendingPicker);
}

/**
 * Renders the list of injected elements with current filters.
 */
function renderList() {
  elements.list.innerHTML = '';
  const filtered = state.items.filter((item) => {
    const matchesType = state.filterType === 'all' || item.type === state.filterType;
    const query = state.filterText.trim().toLowerCase();
    const matchesText =
      !query ||
      item.text.toLowerCase().includes(query) ||
      item.selector.toLowerCase().includes(query) ||
      (item.href || '').toLowerCase().includes(query);
    return matchesType && matchesText;
  });

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No elements found for the current filters.';
    empty.className = 'sp-empty';
    elements.list.appendChild(empty);
    return;
  }

  const template = /** @type {HTMLTemplateElement} */ (document.getElementById('item-template'));
  filtered
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((item) => {
      const fragment = template.content.cloneNode(true);
      /** @type {HTMLElement} */ (fragment.querySelector('[data-role="item-type"]')).textContent = item.type;
      /** @type {HTMLElement} */ (fragment.querySelector('[data-role="item-text"]')).textContent = item.text;
      /** @type {HTMLElement} */ (fragment.querySelector('[data-role="item-selector"]')).textContent = item.selector;
      /** @type {HTMLTimeElement} */ (fragment.querySelector('[data-role="item-date"]')).textContent = formatDate(item.createdAt);

      const card = /** @type {HTMLElement} */ (fragment.querySelector('.sp-card'));
      card.dataset.id = item.id;

      elements.list.appendChild(fragment);
    });
}

/**
 * Handles action clicks (focus, edit, delete) within the list via delegation.
 * @param {MouseEvent} event
 */
function handleListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const action = target.dataset.action;
  if (!action) {
    return;
  }
  const card = target.closest('.sp-card');
  if (!card) {
    return;
  }
  const id = card.dataset.id;
  if (!id) {
    return;
  }
  switch (action) {
    case 'focus':
      handleFocus(id);
      break;
    case 'edit':
      openEditor(id);
      break;
    case 'delete':
      handleDelete(id);
      break;
    default:
      break;
  }
}

/**
 * Requests the content script to highlight the element.
 * @param {string} id
 */
async function handleFocus(id) {
  try {
    await sendMessage(MessageType.FOCUS_ELEMENT, {
      id,
      tabId: state.tabId,
      pageUrl: state.pageUrl,
    });
  } catch (error) {
    showMessage(`Unable to focus element: ${error.message}`);
  }
}

/**
 * Removes an element through the background script and refreshes the list.
 * @param {string} id
 */
async function handleDelete(id) {
  if (!confirm('Remove this injected element?')) {
    return;
  }
  try {
    const items = await sendMessage(MessageType.DELETE, { id, pageUrl: state.pageUrl });
    state.items = Array.isArray(items) ? items : [];
    renderList();
    closeEditor();
  } catch (error) {
    showMessage(`Deletion failed: ${error.message}`);
  }
}

/**
 * Opens the editor with the selected element.
 * @param {string} id
 */
function openEditor(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) {
    showMessage('Element not found. It may have been removed.');
    return;
  }
  state.selectedId = id;
  state.pendingPicker = null;
  elements.detail.hidden = false;
  elements.message.textContent = '';
  elements.typeLabel.textContent = item.type;

  const idField = elements.editor.elements.namedItem('id');
  const pageField = elements.editor.elements.namedItem('pageUrl');
  const textField = elements.editor.elements.namedItem('text');
  const selectorField = elements.editor.elements.namedItem('selector');
  const positionField = elements.editor.elements.namedItem('position');
  const positioningField = elements.editor.elements.namedItem('positioning');
  if (idField instanceof HTMLInputElement) idField.value = item.id;
  if (pageField instanceof HTMLInputElement) pageField.value = item.pageUrl;
  if (textField instanceof HTMLInputElement) textField.value = item.text;
  if (selectorField instanceof HTMLInputElement) selectorField.value = item.selector;
  if (positionField instanceof HTMLSelectElement) positionField.value = item.position;
  if (positioningField instanceof HTMLSelectElement) positioningField.value = item.style?.position || '';

  fillStyleFields(item.style || {});
  const hrefField = elements.editor.elements.namedItem('href');
  if (hrefField instanceof HTMLInputElement) {
    if (item.type === 'link') {
    hrefField.value = item.href || '';
  } else {
    hrefField.value = '';
  }
  if (hrefField instanceof HTMLInputElement) {
    hrefField.required = item.type === 'link';
    hrefField.placeholder = item.type === 'link' ? 'https://example.com' : 'https://example.com (可选)';
  }
}
}

/**
 * Resets and hides the editor.
 */
function closeEditor() {
  state.selectedId = null;
  cancelPickerFor('editor');
  elements.editor.reset();
  elements.detail.hidden = true;
  elements.message.textContent = '';
}

/**
 * Handles the editor submission by sending the update to the background script.
 * @returns {Promise<void>}
 */
async function handleEditorSubmit() {
  if (!state.selectedId) {
    return;
  }
  let payload;
  try {
    payload = buildPayloadFromEditor();
  } catch (error) {
    showMessage(error.message);
    return;
  }
  if (payload.type === 'link' && !payload.href) {
    showMessage('Provide a valid URL for the link.');
    return;
  }
  try {
    const items = await sendMessage(MessageType.UPDATE, payload);
    state.items = Array.isArray(items) ? items : [];
    renderList();
    showMessage('Changes saved.');
  } catch (error) {
    showMessage(`Update failed: ${error.message}`);
  }
}

/**
 * Constructs the payload based on the editor form state.
 * @returns {import('../common/types.js').InjectedElement}
 */
function buildPayloadFromEditor() {
  const formData = new FormData(elements.editor);
  const idValue = formData.get('id');
  if (!idValue) {
    throw new Error('Missing element identifier.');
  }
  const id = idValue.toString();
  const original = state.items.find((item) => item.id === id);
  const style = collectStyle(formData);
  const elementType =
    original?.type || /** @type {'button' | 'link'} */ (elements.typeLabel.textContent === 'link' ? 'link' : 'button');
  const rawHref = (formData.get('href') || '').toString().trim();
  const sanitizedHref = rawHref ? sanitizeUrl(rawHref) : undefined;
  if (elementType === 'link' && !sanitizedHref) {
    throw new Error('请提供有效的链接 URL。');
  }
  if (elementType === 'button' && rawHref && !sanitizedHref) {
    throw new Error('请输入合法的 URL（例如 https://example.com）。');
  }
  return {
    id,
    pageUrl: original?.pageUrl || state.pageUrl,
    type: elementType,
    text: (formData.get('text') || '').toString().trim(),
    href: sanitizedHref,
    selector: (formData.get('selector') || '').toString(),
    position: /** @type {'append' | 'prepend' | 'before' | 'after'} */ (formData.get('position') || 'append'),
    style,
    createdAt: original?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Extracts style fields shared by creator and editor forms.
 * @param {FormData} formData
 * @returns {import('../common/types.js').InjectedElementStyle}
 */
function collectStyle(formData) {
  const positioning = formData.get('positioning')?.toString().trim() || '';
  /** @type {import('../common/types.js').InjectedElementStyle} */
  const style = {};
  if (positioning) {
    style.position = /** @type {'static' | 'relative' | 'absolute' | 'fixed'} */ (positioning);
  }
  ['color', 'backgroundColor', 'fontSize', 'padding', 'borderRadius', 'top', 'right', 'bottom', 'left'].forEach((key) => {
    const value = formData.get(key);
    if (typeof value === 'string' && value.trim() !== '') {
      style[key] = value.trim();
    }
  });
  return style;
}

/**
 * Populates the editor style inputs.
 * @param {import('../common/types.js').InjectedElementStyle} style
 */
function fillStyleFields(style) {
  ['color', 'backgroundColor', 'fontSize', 'padding', 'borderRadius', 'top', 'right', 'bottom', 'left'].forEach((key) => {
    const field = elements.editor.elements.namedItem(key);
    if (field instanceof HTMLInputElement) {
      field.value = style[key] || '';
    }
  });
}

/**
 * Appends messaging listeners for background-originated updates.
 */
function registerMessageListener() {
  chrome.runtime.onMessage.addListener((message) => {
    if (!message?.type || (message.pageUrl && message.pageUrl !== state.pageUrl)) {
      return;
    }
    switch (message.type) {
      case MessageType.PICKER_RESULT: {
        if (message.data?.selector) {
          if (state.pendingPicker === 'creator' && elements.creatorForm) {
            const selectorField = elements.creatorForm.elements.namedItem('selector');
            if (selectorField instanceof HTMLInputElement) {
              selectorField.value = message.data.selector;
            }
            showCreatorMessage(`已选择 ${formatPreview(message.data.preview)}。`);
          } else if (state.pendingPicker === 'editor') {
            const selectorField = elements.editor.elements.namedItem('selector');
            if (selectorField instanceof HTMLInputElement) {
              selectorField.value = message.data.selector;
            }
            showMessage(`已选择 ${formatPreview(message.data.preview)}。`);
          }
        }
        state.pendingPicker = null;
        break;
      }
      case MessageType.PICKER_CANCELLED:
        if (state.pendingPicker === 'creator') {
          showCreatorMessage('已取消拾取。');
        } else if (state.pendingPicker === 'editor') {
          showMessage('已取消拾取。');
        }
        state.pendingPicker = null;
        break;
      case MessageType.REHYDRATE:
        state.items = Array.isArray(message.data) ? message.data : [];
        renderList();
        break;
      case MessageType.UPDATE: {
        const item = message.data;
        if (!item) {
          break;
        }
        const index = state.items.findIndex((entry) => entry.id === item.id);
        if (index >= 0) {
          state.items[index] = item;
        } else {
          state.items.push(item);
        }
        renderList();
        break;
      }
      case MessageType.DELETE:
        state.items = state.items.filter((item) => item.id !== message.data?.id);
        renderList();
        closeEditor();
        break;
      default:
        break;
    }
  });
}

/**
 * Displays a helper message at the bottom of the editor pane.
 * @param {string} message
 */
function showMessage(message) {
  elements.message.textContent = message;
}

/**
 * Displays status text for the creator form.
 * @param {string} message
 */
function showCreatorMessage(message) {
  if (elements.creatorMessage) {
    elements.creatorMessage.textContent = message;
  }
}

/**
 * Formats selector preview metadata.
 * @param {{ tag?: string; text?: string; classes?: string } | undefined} preview
 * @returns {string}
 */
function formatPreview(preview) {
  if (!preview) {
    return '目标元素';
  }
  const parts = [preview.tag || 'element'];
  if (preview.classes) {
    parts.push(`.${preview.classes}`);
  }
  if (preview.text) {
    parts.push(`“${preview.text}”`);
  }
  return parts.join(' ');
}

/**
 * Formats timestamps for the UI.
 * @param {number} timestamp
 * @returns {string}
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

/**
 * Converts a raw URL into the storage-friendly variant.
 * @param {string} url
 * @returns {string}
 */
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}${u.search}`;
  } catch (error) {
    return url;
  }
}

/**
 * Sanitizes a user-provided URL.
 * @param {string} href
 * @returns {string | undefined}
 */
function sanitizeUrl(href) {
  if (!href) {
    return undefined;
  }
  try {
    const url = new URL(href, state.pageUrl);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
      return url.href;
    }
  } catch (error) {
    return undefined;
  }
  return undefined;
}
