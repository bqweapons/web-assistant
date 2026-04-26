import { useCallback, useEffect, useRef, useState } from 'react';
import { findStepById } from '../components/flowSteps/treeOps';
import type { StepData } from '../components/flowSteps/types';

// Draft-state container for FlowStepsBuilder. Owns `draftSteps`, its
// synchronous commit path, and the two reconciliation effects:
//
//   1. External `steps` prop sync — the recorder / parent may push new
//      steps while the drawer is open. We overwrite our draft only when
//      the incoming prop is NOT the same reference as our latest commit
//      (i.e. not the onChange round-trip).
//   2. `resetKey` lifecycle — a fresh open (new flow / switched site)
//      drops local UI state via the `onResetKeyChange` callback.
//
// Critical invariant (REVIEW-FIXES Phase 0 batch fix): `commitSteps`
// fires `onChange(next)` SYNCHRONOUSLY at the mutation site. We do NOT
// introduce a `useEffect([draftSteps]) -> onChange` reconciliation and
// we do NOT re-add `syncingFromPropsRef` / `initializedRef`. All
// mutation callers (updateField, addStep, handleDeleteStep, etc) must
// go through this `commitSteps`.

type UseFlowStepsDraftArgs = {
  steps: StepData[];
  resetKey: string | number | undefined;
  onChange: ((steps: StepData[]) => void) | undefined;
  onStepsReplacedExternally: (next: StepData[]) => void;
  onResetKeyChange: () => void;
};

export type UseFlowStepsDraftResult = {
  draftSteps: StepData[];
  draftStepsRef: React.MutableRefObject<StepData[]>;
  commitSteps: (updater: (prev: StepData[]) => StepData[]) => void;
};

export function useFlowStepsDraft({
  steps,
  resetKey,
  onChange,
  onStepsReplacedExternally,
  onResetKeyChange,
}: UseFlowStepsDraftArgs): UseFlowStepsDraftResult {
  const [draftSteps, setDraftSteps] = useState<StepData[]>(steps);
  const draftStepsRef = useRef<StepData[]>(draftSteps);
  draftStepsRef.current = draftSteps;

  const onChangeRef = useRef(onChange);
  const appliedResetKeyRef = useRef<string | number | symbol>(Symbol('initial-reset'));
  // Stable refs for the reconciliation callbacks — we intentionally do
  // not include them in the effect dep arrays so they can't retrigger
  // the resync. Only `steps` / `resetKey` drive those effects.
  const onStepsReplacedRef = useRef(onStepsReplacedExternally);
  const onResetKeyChangeRef = useRef(onResetKeyChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onStepsReplacedRef.current = onStepsReplacedExternally;
  }, [onStepsReplacedExternally]);

  useEffect(() => {
    onResetKeyChangeRef.current = onResetKeyChange;
  }, [onResetKeyChange]);

  const commitSteps = useCallback((updater: (prev: StepData[]) => StepData[]) => {
    const prev = draftStepsRef.current;
    const next = updater(prev);
    if (next === prev) {
      return;
    }
    draftStepsRef.current = next;
    setDraftSteps(next);
    onChangeRef.current?.(next);
  }, []);

  // External steps prop changes (e.g. recorder appending steps while
  // drawer is open). Skip when the prop matches our own latest commit —
  // that's just our onChange round-trip.
  useEffect(() => {
    if (steps === draftStepsRef.current) {
      return;
    }
    draftStepsRef.current = steps;
    setDraftSteps(steps);
    onStepsReplacedRef.current(steps);
  }, [steps]);

  // Fresh open (new flow / switched site) resets editor UI state.
  useEffect(() => {
    if (typeof resetKey === 'undefined') {
      return;
    }
    if (appliedResetKeyRef.current === resetKey) {
      return;
    }
    appliedResetKeyRef.current = resetKey;
    onResetKeyChangeRef.current();
  }, [resetKey]);

  return { draftSteps, draftStepsRef, commitSteps };
}

// Re-export so callers needing to narrow activeStepId after a delete can
// reuse the same helper — keeps the import surface in the builder slim.
export { findStepById };
