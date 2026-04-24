import type {
  FlowRunAtomicStepType,
  FlowRunExecuteResultPayload,
  FlowRunExecuteStepPayload,
} from '../../../shared/messages';
import { truncateForLog } from './tokenRenderer';
import { redactIfTainted, type TaintedPayloadField } from './types';

// 1.5 — taintedFields redacts expected/message when they're secret-derived.
// selector is intentionally NOT redacted even when tainted: it's a DOM
// query string, users need it in logs to debug, and while a secret-in-
// selector is unusual it's not the same leak severity as printing a
// password in plaintext. Revisit if real attack scenarios surface.
export const formatAtomicStartMessage = (
  stepType: FlowRunAtomicStepType,
  payload: FlowRunExecuteStepPayload,
  taintedFields: Set<TaintedPayloadField>,
) => {
  const safeExpected = truncateForLog(redactIfTainted(payload.expected, taintedFields.has('expected')));
  const safeMessage = truncateForLog(redactIfTainted(payload.message, taintedFields.has('message')));
  if (stepType === 'click') {
    return `Click selector "${truncateForLog(payload.selector || '')}".`;
  }
  if (stepType === 'input') {
    return `Input value into "${truncateForLog(payload.selector || '')}".`;
  }
  if (stepType === 'wait') {
    if (payload.mode === 'time') {
      return `Wait ${payload.durationMs ?? 0} ms.`;
    }
    if (payload.mode === 'appear') {
      return `Wait for "${truncateForLog(payload.selector || '')}" to appear.`;
    }
    if (payload.mode === 'disappear') {
      return `Wait for "${truncateForLog(payload.selector || '')}" to disappear.`;
    }
    return `Wait until "${truncateForLog(payload.selector || '')}" ${payload.operator || 'contains'} "${safeExpected}".`;
  }
  if (stepType === 'assert') {
    return `Assert "${truncateForLog(payload.selector || '')}" ${payload.operator || 'contains'} "${safeExpected}".`;
  }
  if (stepType === 'popup') {
    return `Show popup "${safeMessage}".`;
  }
  if (stepType === 'read') {
    return `Read value from "${truncateForLog(payload.selector || '')}".`;
  }
  if (stepType === 'condition') {
    return `Check condition on "${truncateForLog(payload.selector || '')}".`;
  }
  return `Execute ${stepType} step.`;
};

// 1.5 — Narrowed result type. `actual` and `sensitive` are deliberately
// absent from the type signature so any attempt to inline them into a
// success-log message is a compile error. `details.actual` is also
// stripped via the Omit override. If a formatter needs richer info,
// update the pick set here after reviewing the leak surface.
// taintedFields mirrors the startMessage contract: popup.message is
// echoed back by content as details.popupMessage, so the 'message' taint
// flag must redact both.
export const formatAtomicSuccessMessage = (
  stepType: FlowRunAtomicStepType,
  payload: FlowRunExecuteStepPayload,
  result: {
    ok: FlowRunExecuteResultPayload['ok'];
    conditionMatched?: FlowRunExecuteResultPayload['conditionMatched'];
    // `expected` is also omitted: the content script echoes payload.expected
    // back into details.expected verbatim, so it inherits the full taint of
    // the original payload but has no separate redaction path. A future
    // formatter that wants to show "expected X, got Y" must go through
    // `payload.expected` + taintedFields check, not this echo. `popupMessage`
    // intentionally stays — it's consumed as a fallback and is redacted
    // manually via `taintedFields.has('message')`; a future cleanup could
    // fold it into this Omit and re-extract purely from payload.message.
    details?: Omit<NonNullable<FlowRunExecuteResultPayload['details']>, 'actual' | 'expected'>;
    error?: FlowRunExecuteResultPayload['error'];
    errorCode?: FlowRunExecuteResultPayload['errorCode'];
  },
  taintedFields: Set<TaintedPayloadField>,
) => {
  const details = result.details;
  if (stepType === 'click') {
    const clickedName = details?.elementText ? ` "${truncateForLog(details.elementText)}"` : '';
    return `Clicked${clickedName} (${truncateForLog(payload.selector || '')}).`;
  }
  if (stepType === 'input') {
    const fieldName = details?.fieldName ? truncateForLog(details.fieldName) : truncateForLog(payload.selector || '');
    return `Input completed into ${fieldName}.`;
  }
  if (stepType === 'wait') {
    if (payload.mode === 'time') {
      return `Waited ${payload.durationMs ?? 0} ms.`;
    }
    if (payload.mode === 'appear') {
      return `Selector appeared: ${truncateForLog(payload.selector || '')}.`;
    }
    if (payload.mode === 'disappear') {
      return `Selector disappeared: ${truncateForLog(payload.selector || '')}.`;
    }
    return `Wait condition matched on ${truncateForLog(payload.selector || '')}.`;
  }
  if (stepType === 'assert') {
    return `Assertion passed on ${truncateForLog(payload.selector || '')}.`;
  }
  if (stepType === 'popup') {
    const rawMessage = payload.message || details?.popupMessage || '';
    return `Popup shown: "${truncateForLog(redactIfTainted(rawMessage, taintedFields.has('message')))}".`;
  }
  if (stepType === 'read') {
    return `Read completed from ${truncateForLog(payload.selector || '')}.`;
  }
  if (stepType === 'condition') {
    return result.conditionMatched ? 'Condition matched.' : 'Condition not matched.';
  }
  return `${stepType} step completed.`;
};
