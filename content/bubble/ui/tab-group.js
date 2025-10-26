import { createSection } from './field.js';

let tabIdCounter = 0;

/**
 * Creates the tabbed layout used by the editor sections.
 * @returns {{
 *   container: HTMLElement;
 *   addSection(titleText: string, descriptionText?: string): {
 *     tabButton: HTMLButtonElement;
 *     section: HTMLElement;
 *     content: HTMLElement;
 *     visible: boolean;
 *     setVisible(visible: boolean): void;
 *   };
 *   activate(sectionObj: any): void;
 * }}
 */
export function createTabGroup() {
  const container = document.createElement('div');
  Object.assign(container.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: '1 1 auto',
    minHeight: '0',
  });

  const tabList = document.createElement('div');
  tabList.setAttribute('role', 'tablist');
  Object.assign(tabList.style, {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    paddingBottom: '6px',
    borderBottom: '1px solid rgba(148, 163, 184, 0.25)',
  });

  const panels = document.createElement('div');
  Object.assign(panels.style, {
    flex: '1 1 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: '0',
  });

  container.append(tabList, panels);

  const sections = [];
  let activeSection = null;

  function applyTabState(sectionObj, isActive) {
    sectionObj.tabButton.setAttribute('aria-selected', isActive ? 'true' : 'false');
    sectionObj.tabButton.style.backgroundColor = isActive ? 'rgba(59, 130, 246, 0.12)' : 'transparent';
    sectionObj.tabButton.style.borderColor = isActive
      ? 'rgba(59, 130, 246, 0.35)'
      : 'rgba(148, 163, 184, 0.45)';
    sectionObj.tabButton.style.color = isActive ? '#1d4ed8' : '#475569';
  }

  function ensureActiveSection() {
    if (activeSection && activeSection.visible) {
      return;
    }
    const next = sections.find((section) => section.visible);
    if (next) {
      activate(next);
    }
  }

  function activate(sectionObj) {
    if (!sectionObj.visible) {
      return;
    }
    if (activeSection === sectionObj) {
      sectionObj.section.style.display = 'flex';
      applyTabState(sectionObj, true);
      return;
    }
    if (activeSection) {
      activeSection.section.style.display = 'none';
      applyTabState(activeSection, false);
    }
    activeSection = sectionObj;
    sectionObj.section.style.display = 'flex';
    applyTabState(sectionObj, true);
  }

  return {
    container,
    addSection(titleText, descriptionText = '') {
      const { section, content } = createSection(titleText, descriptionText);
      section.style.display = 'none';

      const tabButton = document.createElement('button');
      tabButton.type = 'button';
      tabButton.textContent = titleText;
      tabButton.setAttribute('role', 'tab');

      const tabId = `page-augmentor-tab-${++tabIdCounter}`;
      const panelId = `${tabId}-panel`;
      tabButton.id = tabId;
      section.id = panelId;
      section.setAttribute('role', 'tabpanel');
      section.setAttribute('aria-labelledby', tabId);
      tabButton.setAttribute('aria-controls', panelId);

      Object.assign(tabButton.style, {
        border: '1px solid rgba(148, 163, 184, 0.45)',
        background: 'transparent',
        borderRadius: '999px',
        padding: '6px 14px',
        fontSize: '12px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        color: '#475569',
        cursor: 'pointer',
        transition: 'all 0.16s ease',
        boxShadow: 'none',
      });

      const sectionObj = {
        tabButton,
        section,
        content,
        visible: true,
        setVisible(visible) {
          if (sectionObj.visible === visible) {
            return;
          }
          sectionObj.visible = visible;
          tabButton.style.display = visible ? '' : 'none';
          if (!visible) {
            section.style.display = 'none';
            applyTabState(sectionObj, false);
            if (activeSection === sectionObj) {
              activeSection = null;
              ensureActiveSection();
            }
          } else {
            ensureActiveSection();
          }
        },
      };

      tabButton.addEventListener('mouseenter', () => {
        if (activeSection === sectionObj || !sectionObj.visible) {
          return;
        }
        tabButton.style.borderColor = 'rgba(148, 163, 184, 0.65)';
        tabButton.style.backgroundColor = 'rgba(148, 163, 184, 0.12)';
      });

      tabButton.addEventListener('mouseleave', () => {
        if (activeSection === sectionObj || !sectionObj.visible) {
          return;
        }
        tabButton.style.backgroundColor = 'transparent';
        tabButton.style.borderColor = 'rgba(148, 163, 184, 0.45)';
      });

      tabButton.addEventListener('click', () => activate(sectionObj));

      sections.push(sectionObj);
      tabList.appendChild(tabButton);
      panels.appendChild(section);

      if (!activeSection && sectionObj.visible) {
        activate(sectionObj);
      }

      return sectionObj;
    },
    activate,
  };
}
