// 拡張機能内のメッセージング処理を共通化するヘルパー群。
import { noop } from './types.js';

// MessageType オブジェクトは、拡張機能内部で利用される全てのメッセージ識別子を集中管理する。
// ここで定義される値は、サイドパネル・コンテンツスクリプト・バックグラウンドなど、
// それぞれの実行コンテキスト間の通信における "type" プロパティとして利用される。
// 一箇所で宣言しておくことで、スペルミスや定義漏れによるバグを防ぎつつ、
// IDE の補完やリファクタリング時に安全に追跡できるようにしている。
export const MessageType = {
  LIST_BY_URL: 'LIST_BY_URL',
  LIST_ALL: 'LIST_ALL',
  LIST_FLOW_STORE: 'LIST_FLOW_STORE',
  LIST_HIDDEN_STORE: 'LIST_HIDDEN_STORE',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  CLEAR_PAGE: 'CLEAR_PAGE',
  FOCUS_ELEMENT: 'FOCUS_ELEMENT',
  START_PICKER: 'START_PICKER',
  CANCEL_PICKER: 'CANCEL_PICKER',
  SET_EDIT_MODE: 'SET_EDIT_MODE',
  SET_EDITING_ELEMENT: 'SET_EDITING_ELEMENT',
  OPEN_ELEMENT_DRAWER: 'OPEN_ELEMENT_DRAWER',
  INIT_CREATE: 'INIT_CREATE',
  BEGIN_DRAFT: 'BEGIN_DRAFT',
  CANCEL_DRAFT: 'CANCEL_DRAFT',
  FINALIZE_DRAFT: 'FINALIZE_DRAFT',
  PREVIEW_ELEMENT: 'PREVIEW_ELEMENT',
  PICKER_RESULT: 'PICKER_RESULT',
  PICKER_CANCELLED: 'PICKER_CANCELLED',
  REHYDRATE: 'REHYDRATE',
  IMPORT_STORE: 'IMPORT_STORE',
  REGISTER_EXECUTOR: 'REGISTER_EXECUTOR',
  RUN_STEP: 'RUN_STEP',
  STEP_DONE: 'STEP_DONE',
  STEP_ERROR: 'STEP_ERROR',
  REJOIN_FLOW: 'REJOIN_FLOW',
  RUN_FLOW: 'RUN_FLOW',
  PAUSE_FLOW: 'PAUSE_FLOW',
  RESUME_FLOW: 'RESUME_FLOW',
  STOP_FLOW: 'STOP_FLOW',
  LIST_FLOWS: 'LIST_FLOWS',
  UPSERT_FLOW: 'UPSERT_FLOW',
  DELETE_FLOW: 'DELETE_FLOW',
  LIST_HIDDEN_RULES: 'LIST_HIDDEN_RULES',
  UPSERT_HIDDEN_RULE: 'UPSERT_HIDDEN_RULE',
  DELETE_HIDDEN_RULE: 'DELETE_HIDDEN_RULE',
  SET_HIDDEN_RULE_ENABLED: 'SET_HIDDEN_RULE_ENABLED',
  APPLY_HIDDEN_RULES: 'APPLY_HIDDEN_RULES',
};

/**
 * バックグラウンドへメッセージを送り、レスポンスデータを返す。
 * Sends a message to the background context and resolves with the response payload.
 * @template T
 * @param {string} type
 * @param {unknown} [data]
 * @returns {Promise<T>}
 */
export async function sendMessage(type, data) {
  try {
    // chrome.runtime.sendMessage はコールバックベースの API だが、Chrome では Promise を返すため
    // async/await と組み合わせて呼び出し結果を直感的に扱える。失敗時は { ok: false } を想定している。
    const response = await chrome.runtime.sendMessage({ type, data });
    if (response?.ok) {
      // レスポンスオブジェクトは { ok: true, data: 任意のペイロード } の形を取り、
      // data 部分のみを返すことで呼び出し元の記述を簡潔にする。
      return response.data;
    }
    // 失敗時はエラーメッセージを優先し、未定義の場合は chrome.runtime.lastError も参照する。
    const message = response?.error || chrome.runtime.lastError?.message || 'Unknown messaging error';
    throw new Error(message);
  } catch (error) {
    // Promise が reject された場合でも、lastError が残っていれば優先的に利用する。
    const lastErrorMessage = chrome.runtime.lastError?.message;
    if (lastErrorMessage) {
      throw new Error(lastErrorMessage);
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * 値または Promise を返却する非同期ハンドラを登録する。
 * Registers an async message handler that can return values or promises.
 * @param {(message: { type: string; data: unknown }, sender: chrome.runtime.MessageSender) => (Promise<unknown> | unknown)} handler
 * @returns {() => void}
 */
export function addAsyncMessageListener(handler) {
  const listener = (message, sender, sendResponse) => {
    if (!message?.type) {
      return;
    }
    try {
      const result = handler(message, sender);
      if (result instanceof Promise) {
        // Promise を返却した場合、非同期処理が完了するまで sendResponse を保留する。
        // then/catch で結果を正規化し、呼び出し側に { ok, data | error } の形式で応答する。
        result
          .then((data) => sendResponse({ ok: true, data }))
          .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
        return true;
      }
      // 同期的な値を返却した場合は、そのまま data として包んで返す。
      sendResponse({ ok: true, data: result });
    } catch (error) {
      // ハンドラ内で例外が発生した場合も catch で握り、呼び出し側で一律に処理できるよう整形する。
      sendResponse({ ok: false, error: /** @type {Error} */ (error).message });
    }
    return true;
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

/**
 * 長期接続の Port を開き、メッセージ送信用ヘルパーを提供する。
 * Opens a long-lived connection and returns helpers to post messages.
 * @param {string} name
 * @param {(port: chrome.runtime.Port) => void} onMessage
 * @returns {chrome.runtime.Port}
 */
export function connectPort(name, onMessage = noop) {
  const port = chrome.runtime.connect({ name });
  // 長期接続を確立すると Port オブジェクトが返るため、任意のコールバックで onMessage を束縛する。
  // コンテンツスクリプト側からも listener の解除ができるよう、Port 自体を返す設計にしている。
  port.onMessage.addListener((msg) => onMessage(port, msg));
  return port;
}
