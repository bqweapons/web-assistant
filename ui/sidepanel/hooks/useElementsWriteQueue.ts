import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { setSiteData } from '../../../shared/siteStorageClient';
import type { FlowRecord, StoredElementRecord } from '../sections/elements/normalize';

// Sequenced write queue for the Elements tab. All mutations (create/update/
// delete elements or flows) thread through `runElementsWrite` so that:
//   1. Persistence is serialized via a promise chain — concurrent edits do
//      not interleave and clobber each other.
//   2. React state updates happen only after storage has accepted the
//      write (or synchronously for skipPersist drafts).
//   3. Latest-value refs stay in sync with React state so mutators can see
//      the committed baseline rather than the closure-captured snapshot.

type ElementsWriteContext = {
  elements: StoredElementRecord[];
  flows: FlowRecord[];
};

type ElementsWriteResult<T> = {
  elements: StoredElementRecord[];
  flows: FlowRecord[];
  result?: T;
  skipPersist?: boolean;
};

type UseElementsWriteQueueArgs = {
  normalizedSiteKey: string;
  elements: StoredElementRecord[];
  flows: FlowRecord[];
  setElements: Dispatch<SetStateAction<StoredElementRecord[]>>;
  setFlows: Dispatch<SetStateAction<FlowRecord[]>>;
  onPersistFailure: (error: unknown) => void;
};

export type UseElementsWriteQueueResult = {
  latestElementsRef: React.MutableRefObject<StoredElementRecord[]>;
  latestFlowsRef: React.MutableRefObject<FlowRecord[]>;
  runElementsWrite: <T>(
    opName: string,
    mutate: (
      context: ElementsWriteContext,
    ) => Promise<ElementsWriteResult<T> | null> | ElementsWriteResult<T> | null,
  ) => Promise<T | undefined>;
};

export function useElementsWriteQueue({
  normalizedSiteKey,
  elements,
  flows,
  setElements,
  setFlows,
  onPersistFailure,
}: UseElementsWriteQueueArgs): UseElementsWriteQueueResult {
  const elementsWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestElementsRef = useRef<StoredElementRecord[]>(elements);
  const latestFlowsRef = useRef<FlowRecord[]>(flows);

  useEffect(() => {
    latestElementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    latestFlowsRef.current = flows;
  }, [flows]);

  const persistSiteData = useCallback(
    async (nextElements: StoredElementRecord[], nextFlows: FlowRecord[]) => {
      if (!normalizedSiteKey) {
        return;
      }
      await setSiteData(normalizedSiteKey, {
        elements: nextElements,
        flows: nextFlows,
      });
    },
    [normalizedSiteKey],
  );

  const runElementsWrite = useCallback(
    async <T,>(
      opName: string,
      mutate: (
        context: ElementsWriteContext,
      ) => Promise<ElementsWriteResult<T> | null> | ElementsWriteResult<T> | null,
    ): Promise<T | undefined> => {
      const task = elementsWriteQueueRef.current.then(async () => {
        const baseElements = latestElementsRef.current;
        const baseFlows = latestFlowsRef.current;
        const next = await mutate({ elements: baseElements, flows: baseFlows });
        if (!next) {
          return undefined;
        }
        if (!next.skipPersist) {
          await persistSiteData(next.elements, next.flows);
        }
        latestElementsRef.current = next.elements;
        latestFlowsRef.current = next.flows;
        setElements(() => next.elements);
        setFlows(() => next.flows);
        return next.result;
      });
      elementsWriteQueueRef.current = task.then(
        () => undefined,
        () => undefined,
      );
      try {
        return await task;
      } catch (error) {
        console.warn('elements-write-failed', opName, error);
        onPersistFailure(error);
        throw error;
      }
    },
    [onPersistFailure, persistSiteData, setElements, setFlows],
  );

  return { latestElementsRef, latestFlowsRef, runElementsWrite };
}
