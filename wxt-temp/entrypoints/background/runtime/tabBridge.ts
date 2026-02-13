import type { RuntimeMessage } from '../../../shared/messages';
import {
  isInjectableUrl,
  isRecoverableTabMessageError,
  isRecord,
  normalizeForwardError,
  type BrowserTab,
  type BrowserTabChangeInfo,
} from './pageContext';

export type TabMessageResponse = {
  ok: boolean;
  data?: unknown;
  error?: string;
};

type TabBridgeOptions = {
  runtime?: {
    lastError?: { message?: string };
  };
  tabsApi?: {
    query?: (
      queryInfo: { active: boolean; currentWindow: boolean },
      callback: (tabs: BrowserTab[]) => void,
    ) => void;
    get?: (tabId: number, callback: (tab?: BrowserTab | null) => void) => void;
    update?: (tabId: number, updateProperties: { url: string }, callback: () => void) => void;
    sendMessage?: (tabId: number, message: RuntimeMessage, callback: (response?: unknown) => void) => void;
    onUpdated?: {
      addListener: (
        callback: (tabId: number, changeInfo: BrowserTabChangeInfo, tab: BrowserTab) => void,
      ) => void;
      removeListener: (
        callback: (tabId: number, changeInfo: BrowserTabChangeInfo, tab: BrowserTab) => void,
      ) => void;
    };
  };
  scriptingApi?: {
    executeScript?: (
      injection: { target: { tabId: number; allFrames: boolean }; files: string[] },
      callback: () => void,
    ) => void;
  };
  contentScriptFile: string;
};

export class TabBridge {
  private readonly runtime?: TabBridgeOptions['runtime'];

  private readonly tabsApi?: TabBridgeOptions['tabsApi'];

  private readonly scriptingApi?: TabBridgeOptions['scriptingApi'];

  private readonly contentScriptFile: string;

  constructor(options: TabBridgeOptions) {
    this.runtime = options.runtime;
    this.tabsApi = options.tabsApi;
    this.scriptingApi = options.scriptingApi;
    this.contentScriptFile = options.contentScriptFile;
  }

  async queryActiveTab() {
    const tabsApi = this.tabsApi;
    const query = tabsApi?.query;
    if (!query) {
      return null;
    }
    return new Promise<BrowserTab | null>((resolve) => {
      query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0] ?? null));
    });
  }

  async getTabById(tabId: number) {
    const tabsApi = this.tabsApi;
    const get = tabsApi?.get;
    if (!get) {
      return null;
    }
    return new Promise<BrowserTab | null>((resolve) => {
      get(tabId, (tab) => {
        const error = this.runtime?.lastError?.message;
        if (error) {
          resolve(null);
          return;
        }
        resolve(tab ?? null);
      });
    });
  }

  async updateTabUrl(tabId: number, url: string) {
    const tabsApi = this.tabsApi;
    const update = tabsApi?.update;
    if (!update) {
      throw new Error('Tabs API unavailable.');
    }
    await new Promise<void>((resolve, reject) => {
      update(tabId, { url }, () => {
        const error = this.runtime?.lastError?.message;
        if (error) {
          reject(new Error(error));
          return;
        }
        resolve();
      });
    });
  }

  async executeContentScript(tabId: number) {
    const scriptingApi = this.scriptingApi;
    const executeScript = scriptingApi?.executeScript;
    if (!executeScript) {
      return false;
    }
    return new Promise<boolean>((resolve) => {
      executeScript(
        {
          target: { tabId, allFrames: true },
          files: [this.contentScriptFile],
        },
        () => {
          const error = this.runtime?.lastError?.message;
          resolve(!error);
        },
      );
    });
  }

  async sendMessageToTabRaw(tabId: number, message: RuntimeMessage) {
    const tabsApi = this.tabsApi;
    const sendMessage = tabsApi?.sendMessage;
    if (!sendMessage) {
      return { response: undefined, lastError: 'Tabs API unavailable.' };
    }
    return new Promise<{ response: unknown; lastError?: string }>((resolve) => {
      sendMessage(tabId, message, (response) => {
        resolve({ response, lastError: this.runtime?.lastError?.message });
      });
    });
  }

  async sendMessageToTabWithRetry(tabId: number, message: RuntimeMessage, allowRetry = true): Promise<TabMessageResponse> {
    const { response, lastError } = await this.sendMessageToTabRaw(tabId, message);
    if (lastError) {
      if (allowRetry && isRecoverableTabMessageError(lastError)) {
        const tab = await this.getTabById(tabId);
        if (tab && isInjectableUrl(tab.url)) {
          const injected = await this.executeContentScript(tabId);
          if (injected) {
            return this.sendMessageToTabWithRetry(tabId, message, false);
          }
        }
      }
      return { ok: false, error: normalizeForwardError(lastError) };
    }
    if (isRecord(response) && 'ok' in response) {
      const typed = response as { ok?: boolean; error?: string; data?: unknown };
      if (typed.ok === false) {
        return { ok: false, error: typed.error || 'content-handling-failed' };
      }
      return { ok: true, data: 'data' in typed ? typed.data : response };
    }
    return { ok: true, data: response };
  }

  async forwardToActiveTab(message: RuntimeMessage): Promise<TabMessageResponse> {
    if (!this.tabsApi?.query) {
      return { ok: false, error: 'Tabs API unavailable.' };
    }
    const activeTab = await this.queryActiveTab();
    const tabId = activeTab?.id;
    if (!tabId) {
      return { ok: false, error: 'No active tab.' };
    }
    return this.sendMessageToTabWithRetry(tabId, message, true);
  }

  waitForTabComplete(
    tabId: number,
    timeoutMs: number,
    onUrlChanged?: (changeInfo: BrowserTabChangeInfo, tab: BrowserTab) => void,
  ) {
    const tabsApi = this.tabsApi;
    const onUpdated = tabsApi?.onUpdated;
    const get = tabsApi?.get;
    if (!onUpdated || !get) {
      throw new Error('Tabs API unavailable.');
    }
    return new Promise<BrowserTab>((resolve, reject) => {
      let finished = false;
      const done = (callback: () => void) => {
        if (finished) {
          return;
        }
        finished = true;
        clearTimeout(timeout);
        onUpdated.removeListener(handleUpdated);
        callback();
      };
      const handleUpdated = (updatedTabId: number, changeInfo: BrowserTabChangeInfo, tab: BrowserTab) => {
        if (updatedTabId !== tabId) {
          return;
        }
        if (changeInfo.url || changeInfo.status === 'complete') {
          onUrlChanged?.(changeInfo, tab);
        }
        if (changeInfo.status === 'complete') {
          done(() => resolve(tab));
        }
      };
      const timeout = setTimeout(() => {
        done(() => reject(new Error('Timed out waiting for page load completion.')));
      }, timeoutMs);

      onUpdated.addListener(handleUpdated);
      get(tabId, (tab) => {
        const error = this.runtime?.lastError?.message;
        if (error) {
          done(() => reject(new Error(error)));
          return;
        }
        if (tab?.status === 'complete') {
          done(() => resolve(tab));
        }
      });
    });
  }
}
