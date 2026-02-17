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
  const [siteDataReady, setSiteDataReady] = useState(false);

  useEffect(() => {
    if (!normalizedSiteKey) {
      setElements([]);
      setFlows([]);
      setSiteDataReady(false);
      return;
    }
    setSiteDataReady(false);
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
        setSiteDataReady(true);
      })
      .catch(() => {
        setElements([]);
        setFlows([]);
        setSiteDataReady(true);
      });
  }, [normalizedSiteKey]);

  return {
    elements,
    setElements,
    flows,
    setFlows,
    siteDataReady,
  };
};
