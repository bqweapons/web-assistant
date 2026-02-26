import { useEffect, useState } from 'react';
import { getSiteData } from '../../../../shared/storage';
import {
  normalizeFlowRecord,
  normalizeStoredElement,
  type FlowRecord,
  type StoredElementRecord,
} from './normalize';

export const useElementsStore = (normalizedSiteKey: string) => {
  const [elements, setElements] = useState<StoredElementRecord[]>([]);
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!normalizedSiteKey) {
      setElements([]);
      setFlows([]);
      setStatus('ready');
      setLoadError('');
      return;
    }
    setStatus('loading');
    setLoadError('');
    getSiteData(normalizedSiteKey)
      .then((data) => {
        const normalizedElements =
          (data.elements as unknown[] | undefined)
            ?.map((item) => normalizeStoredElement(item))
            .filter((item): item is StoredElementRecord => Boolean(item)) || [];
        const normalizedFlows = (Array.isArray(data.flows) ? data.flows : [])
          .map((item) => normalizeFlowRecord(item, normalizedSiteKey))
          .filter((item): item is FlowRecord => Boolean(item));
        setElements(normalizedElements);
        setFlows(normalizedFlows);
        setStatus('ready');
      })
      .catch((error) => {
        console.warn('site-load-failed', error);
        setStatus('error');
        setLoadError(error instanceof Error ? error.message : String(error));
      });
  }, [normalizedSiteKey]);

  return {
    elements,
    setElements,
    flows,
    setFlows,
    siteDataReady: status === 'ready',
    status,
    loadError,
  };
};
