import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getLocale,
  getLocaleOptions,
  ready as i18nReady,
  setLocale as setGlobalLocale,
  subscribe,
  t as translate,
} from '../../../common/i18n.js';

export function useI18n() {
  const [locale, setLocaleState] = useState(getLocale());

  useEffect(() => {
    let cancelled = false;
    i18nReady.then((resolved) => {
      if (!cancelled) {
        setLocaleState(resolved);
      }
    });
    const unsubscribe = subscribe((nextLocale) => {
      setLocaleState(nextLocale);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const t = useCallback((key, values) => translate(key, values), [locale]);
  const options = useMemo(() => getLocaleOptions(), [locale]);
  const setLocale = useCallback((nextLocale) => {
    setGlobalLocale(nextLocale);
  }, []);

  return { locale, t, options, setLocale };
}
