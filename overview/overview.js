import { sendMessage, MessageType } from '../common/messaging.js';

const state = {
  store: /** @type {Record<string, import('../common/types.js').InjectedElement[]>} */ ({}),
};

const refs = {
  content: /** @type {HTMLElement} */ (document.querySelector('[data-role="content"]')),
  pageCount: /** @type {HTMLElement} */ (document.querySelector('[data-role="page-count"]')),
  elementCount: /** @type {HTMLElement} */ (document.querySelector('[data-role="element-count"]')),
  summary: /** @type {HTMLElement} */ (document.querySelector('[data-role="summary"]')),
  refresh: /** @type {HTMLButtonElement} */ (document.querySelector('[data-action="refresh"]')),
};

init().catch((error) => {
  console.error('[PageAugmentor] Overview init failed', error);
  refs.content.innerHTML = `<p class="ov-empty">初始化失败：${error.message}</p>`;
});

/**
 * Initializes event listeners and loads initial data.
 */
async function init() {
  refs.refresh.addEventListener('click', () => refresh());
  refs.content.addEventListener('click', handleContentClick);
  await refresh();
}

/**
 * Fetches the entire store and updates the UI.
 * @returns {Promise<void>}
 */
async function refresh() {
  refs.refresh.disabled = true;
  try {
    const store = await sendMessage(MessageType.LIST_ALL);
    state.store = store || {};
    render();
  } catch (error) {
    refs.content.innerHTML = `<p class="ov-empty">加载数据失败：${error.message}</p>`;
  } finally {
    refs.refresh.disabled = false;
  }
}

/**
 * Renders summary and list sections.
 */
function render() {
  const entries = Object.entries(state.store);
  const elementCount = entries.reduce((total, [, items]) => total + (items?.length || 0), 0);
  refs.pageCount.textContent = String(entries.length);
  refs.elementCount.textContent = String(elementCount);

  refs.content.innerHTML = '';
  if (entries.length === 0) {
    refs.content.innerHTML = '<div class="ov-empty">当前尚未添加任何元素。</div>';
    return;
  }

  const pageTemplate = /** @type {HTMLTemplateElement} */ (document.getElementById('page-template'));
  const itemTemplate = /** @type {HTMLTemplateElement} */ (document.getElementById('item-template'));

  entries
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([pageUrl, items]) => {
      const sectionFragment = pageTemplate.content.cloneNode(true);
      const wrapper = /** @type {HTMLElement} */ (sectionFragment.querySelector('.ov-section'));
      wrapper.dataset.pageUrl = pageUrl;
      /** @type {HTMLElement} */ (sectionFragment.querySelector('[data-role="page-url"]')).textContent = pageUrl;
      /** @type {HTMLElement} */ (sectionFragment.querySelector('[data-role="page-meta"]')).textContent = `${items.length} 个元素`;
      const list = /** @type {HTMLElement} */ (sectionFragment.querySelector('[data-role="item-list"]'));

      items
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .forEach((item) => {
          const itemFragment = itemTemplate.content.cloneNode(true);
          const itemNode = /** @type {HTMLElement} */ (itemFragment.querySelector('.ov-item'));
          itemNode.dataset.id = item.id;
          /** @type {HTMLElement} */ (itemFragment.querySelector('[data-role="item-type"]')).textContent = item.type;
          /** @type {HTMLElement} */ (itemFragment.querySelector('[data-role="item-text"]')).textContent = item.text || '(无文本)';
          /** @type {HTMLElement} */ (itemFragment.querySelector('[data-role="item-selector"]')).textContent = item.selector;
          /** @type {HTMLElement} */ (itemFragment.querySelector('[data-role="item-created"]')).textContent = formatDate(item.createdAt);
          list.appendChild(itemFragment);
        });

      refs.content.appendChild(sectionFragment);
    });
}

/**
 * Handles delegated clicks within the content area.
 * @param {MouseEvent} event
 */
function handleContentClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const action = target.dataset.action;
  if (!action) {
    return;
  }
  const section = target.closest('.ov-section');
  const pageUrl = section?.dataset.pageUrl;
  if (!pageUrl) {
    return;
  }
  switch (action) {
    case 'open-page':
      openPage(pageUrl);
      break;
    case 'clear-page':
      clearPageItems(pageUrl);
      break;
    case 'delete-item': {
      const itemId = target.closest('.ov-item')?.dataset.id;
      if (itemId) {
        deleteItem(pageUrl, itemId);
      }
      break;
    }
    case 'focus-item': {
      const itemId = target.closest('.ov-item')?.dataset.id;
      if (itemId) {
        focusItem(pageUrl, itemId);
      }
      break;
    }
    case 'edit-item': {
      const itemId = target.closest('.ov-item')?.dataset.id;
      if (itemId) {
        openForEditing(pageUrl, itemId);
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Opens the corresponding webpage in a new tab.
 * @param {string} pageUrl
 */
function openPage(pageUrl) {
  chrome.tabs.create({ url: pageUrl });
}

/**
 * Removes all items stored for a specific page.
 * @param {string} pageUrl
 */
async function clearPageItems(pageUrl) {
  if (!confirm('确定要删除该页面的所有自定义元素吗？')) {
    return;
  }
  try {
    await sendMessage(MessageType.CLEAR_PAGE, { pageUrl });
    await refresh();
  } catch (error) {
    alert(`删除失败：${error.message}`);
  }
}

/**
 * Deletes a single element.
 * @param {string} pageUrl
 * @param {string} id
 */
async function deleteItem(pageUrl, id) {
  if (!confirm('确定要删除该元素吗？')) {
    return;
  }
  try {
    await sendMessage(MessageType.DELETE, { pageUrl, id });
    await refresh();
  } catch (error) {
    alert(`删除失败：${error.message}`);
  }
}

/**
 * Attempts to focus the element in an existing tab.
 * @param {string} pageUrl
 * @param {string} id
 */
async function focusItem(pageUrl, id) {
  const tab = await findTabByPageUrl(pageUrl);
  if (!tab?.id) {
    const created = await chrome.tabs.create({ url: pageUrl });
    alert('已打开新标签页，请手动打开侧边栏并定位元素。');
    return created;
  }
  await chrome.tabs.update(tab.id, { active: true });
  try {
    await sendMessage(MessageType.FOCUS_ELEMENT, { pageUrl, id, tabId: tab.id });
  } catch (error) {
    alert(`定位失败：${error.message}`);
  }
}

/**
 * Opens the target page and side panel for editing.
 * @param {string} pageUrl
 * @param {string} id
 */
async function openForEditing(pageUrl, id) {
  const tab = await ensureTab(pageUrl);
  if (!tab?.id) {
    return;
  }
  await chrome.tabs.update(tab.id, { active: true });
  if (chrome.sidePanel?.open) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
  await sendMessage(MessageType.REHYDRATE, { pageUrl });
  try {
    await sendMessage(MessageType.FOCUS_ELEMENT, { pageUrl, id, tabId: tab.id });
  } catch (error) {
    console.warn('Failed to focus element after opening side panel', error);
  }
  alert('请在侧边栏中找到该元素进行编辑。');
}

/**
 * Finds an open tab whose URL matches the stored key.
 * @param {string} pageUrl
 * @returns {Promise<chrome.tabs.Tab | undefined>}
 */
async function findTabByPageUrl(pageUrl) {
  const tabs = await chrome.tabs.query({});
  return tabs.find((tab) => tab.url && normalizeUrl(tab.url) === pageUrl);
}

/**
 * Ensures there is a tab for the given page; opens one if needed.
 * @param {string} pageUrl
 * @returns {Promise<chrome.tabs.Tab | undefined>}
 */
async function ensureTab(pageUrl) {
  const existing = await findTabByPageUrl(pageUrl);
  if (existing) {
    return existing;
  }
  return chrome.tabs.create({ url: pageUrl, active: true });
}

/**
 * Formats a timestamp for display.
 * @param {number} timestamp
 * @returns {string}
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

/**
 * Normalizes a URL to match storage keys.
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
