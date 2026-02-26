// サイドパネルからブラウザタブを検索・生成するための補助関数。
// URL 正規化ロジックを共通モジュールへ委譲し、Chrome API 呼び出しを一箇所にまとめる。
import { normalizePageUrl } from '../../../common/url.js';

/**
 * 指定したページ URL と一致するタブを検索する。
 * Looks up an existing tab that matches the normalized page URL if one is already open.
 */
export async function findTabByPageUrl(pageUrl) {
  const tabs = await chrome.tabs.query({});
  return tabs.find((tab) => tab.url && normalizePageUrl(tab.url) === pageUrl);
}

/**
 * 該当タブが見つかればそのまま返し、存在しない場合は新規タブを生成する。
 * Ensures the user ends up on a tab that matches the requested page URL.
 */
export async function ensureTab(pageUrl) {
  const existing = await findTabByPageUrl(pageUrl);
  if (existing) {
    return existing;
  }
  return chrome.tabs.create({ url: pageUrl, active: true });
}
