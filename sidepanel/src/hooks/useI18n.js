// サイドパネル内で国際化コンテキストを提供する React フック。
// 共通 i18n モジュールの状態と購読 API を薄いラッパーで包み、
// コンポーネントからは `useI18n()` の戻り値だけで翻訳・ロケール変更を扱えるようにする。
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getLocale,
  getLocaleOptions,
  ready as i18nReady,
  setLocale as setGlobalLocale,
  subscribe,
  t as translate,
} from '../../../common/i18n.js';

/**
 * 共通 i18n ストアと同期し、翻訳関数・ロケール一覧・変更ハンドラを返す。
 * Returns the current locale alongside helpers that stay in sync with the shared i18n store.
 */
export function useI18n() {
  const [locale, setLocaleState] = useState(getLocale());

  useEffect(() => {
    // 初期化が非同期で完了するまでは既定ロケールを表示し、完了後に確定値へ置き換える。
    let cancelled = false;
    i18nReady.then((resolved) => {
      if (!cancelled) {
        setLocaleState(resolved);
      }
    });
    // グローバルロケール変更を購読し、他コンポーネントからの更新にも追従する。
    const unsubscribe = subscribe((nextLocale) => {
      setLocaleState(nextLocale);
    });
    return () => {
      // アンマウント時に非同期更新と購読を安全に破棄する。
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // 現在のロケールに基づく翻訳関数。依存配列でロケール変化時だけ再生成する。
  const t = useCallback((key, values) => translate(key, values), [locale]);
  // ロケール変更 UI 向けに最新の選択肢をメモ化して返す。
  const options = useMemo(() => getLocaleOptions(), [locale]);
  // サイドパネルからロケールを更新するとグローバル i18n ストアへ反映される。
  const setLocale = useCallback((nextLocale) => {
    setGlobalLocale(nextLocale);
  }, []);

  return { locale, t, options, setLocale };
}
