import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ChevronRight,
  Code2,
  GripVertical,
  Trash2,
} from 'lucide-react';
import SelectMenu from './SelectMenu';
import StepPicker from './StepPicker';
import { t, useLocale } from '../utils/i18n';
import type { SelectorPickerAccept } from '../../../shared/messages';
import { isSecretTokenValue } from '../../../shared/secrets';
import { buildDataSourceSummary, parseDataSourceMeta } from './flowSteps/dataSourceParser';
import { buildStepSummary, getFieldValue, shouldShowField } from './flowSteps/summary';
import { createInputStepWithValue, createStepTemplate } from './flowSteps/templates';
import { StepFieldControl } from './flowSteps/fieldRenderer';
import InputSecretValueControl from './flowSteps/InputSecretValueControl';
import {
  FIELD_LABEL_KEYS,
  getConditionOperators,
  getInputValueShortcuts,
  getTransformCodeShortcuts,
  getWaitModes,
} from './flowSteps/shortcutConfig';
import {
  findStepById,
  isSameContext,
  removeStepById,
  reorderWithinContext,
  updateSteps,
  type StepTreeContext,
} from './flowSteps/treeOps';
import type { StepData, StepField } from './flowSteps/types';

export type { StepData };

type AddStepPlaceholderProps = {
  label: string;
  ariaLabel: string;
  onPick: (type: string) => void;
  onDropReorder?: () => void;
  canDrop?: boolean;
};

function AddStepPlaceholder({ label, ariaLabel, onPick, onDropReorder, canDrop }: AddStepPlaceholderProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const handleActivate = () => {
    triggerRef.current?.click();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="cursor-pointer rounded-lg border border-dashed border-border/60 bg-secondary px-3 py-2 shadow-sm transition hover:border-border/80 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label={ariaLabel}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest?.('[data-step-picker]') || target.closest?.('[data-step-picker-menu]')) {
          return;
        }
        handleActivate();
      }}
      onDragOver={(event) => {
        if (!onDropReorder) {
          return;
        }
        if (canDrop) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }
      }}
      onDrop={(event) => {
        if (!onDropReorder || !canDrop) {
          return;
        }
        event.preventDefault();
        onDropReorder();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleActivate();
        }
      }}
    >
      <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-muted-foreground">
        <StepPicker ariaLabel={ariaLabel} onPick={onPick} buttonRef={triggerRef} />
        <span>{label}</span>
      </div>
    </div>
  );
}

const DEFAULT_STEPS: StepData[] = [];

type FlowStepsBuilderProps = {
  steps?: StepData[];
  resetKey?: string | number;
  onChange?: (steps: StepData[]) => void;
  onStartPicker?: (accept: SelectorPickerAccept) => Promise<string | null>;
};

export default function FlowStepsBuilder({
  steps = DEFAULT_STEPS,
  resetKey,
  onChange,
  onStartPicker,
}: FlowStepsBuilderProps) {
  useLocale();
  const waitModes = getWaitModes();
  const conditionOperators = getConditionOperators();
  const inputValueShortcuts = getInputValueShortcuts();
  const transformCodeShortcuts = getTransformCodeShortcuts();
  const stepTypeLabels: Record<string, string> = {
    click: t('sidepanel_step_click_label', 'Click'),
    input: t('sidepanel_step_input_label', 'Input'),
    popup: t('sidepanel_step_popup_label', 'Popup'),
    loop: t('sidepanel_step_loop_label', 'Loop'),
    'data-source': t('sidepanel_step_data_source_label', 'Data Source'),
    'if-else': t('sidepanel_step_if_else_label', 'If / Else'),
    wait: t('sidepanel_step_wait_label', 'Wait'),
    navigate: t('sidepanel_step_navigate_label', 'Navigate'),
    assert: t('sidepanel_step_assert_label', 'Assert'),
  };
  const [draftSteps, setDraftSteps] = useState<StepData[]>(steps);
  const [activeStepId, setActiveStepId] = useState('');
  const [activeFieldTarget, setActiveFieldTarget] = useState<{ stepId: string; fieldId: string } | null>(null);
  const [transformEditorTarget, setTransformEditorTarget] = useState<{
    stepId: string;
    fieldId: string;
  } | null>(null);
  const [inputValueModes, setInputValueModes] = useState<Record<string, 'literal' | 'secret'>>({});
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>({});
  const [dragState, setDragState] = useState<
    | null
    | {
        stepId: string;
        context: StepTreeContext;
      }
  >(null);
  const syncingFromPropsRef = useRef(false);
  const initializedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const appliedResetKeyRef = useRef<string | number | symbol>(Symbol('initial-reset'));
  const setFieldInputRef =
    (_stepId: string, _fieldId: string) => (_node: HTMLInputElement | HTMLTextAreaElement | null) => undefined;
  const templateOptions = { waitModes, conditionOperators };
  const summarizeStep = (step: StepData) => buildStepSummary(step, conditionOperators);

  const getFieldLabel = (label: string) => {
    const key = FIELD_LABEL_KEYS[label];
    return key ? t(key, label) : label;
  };

  const resolveFieldOptions = (step: StepData, field: StepField) => {
    if (field.type !== 'select') {
      return field.options;
    }
    if (step.type === 'wait' && field.id === 'mode') {
      return waitModes;
    }
    if ((step.type === 'wait' || step.type === 'if-else' || step.type === 'assert') && field.id === 'operator') {
      return conditionOperators;
    }
    return field.options;
  };

  const getBranchLabel = (branchId: string, fallback: string) => {
    if (branchId === 'branch-then') {
      return t('sidepanel_steps_branch_then', 'Then');
    }
    if (branchId === 'branch-else') {
      return t('sidepanel_steps_branch_else', 'Else');
    }
    return fallback;
  };

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (typeof resetKey !== 'undefined') {
      if (appliedResetKeyRef.current === resetKey) {
        return;
      }
      appliedResetKeyRef.current = resetKey;
    }
    syncingFromPropsRef.current = true;
    setDraftSteps(steps);
    setActiveStepId((prev) => {
      if (prev && findStepById(steps, prev)) {
        return prev;
      }
      return '';
    });
    setTransformEditorTarget(null);
  }, [resetKey, steps]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      syncingFromPropsRef.current = false;
      return;
    }
    if (syncingFromPropsRef.current) {
      syncingFromPropsRef.current = false;
      return;
    }
    onChangeRef.current?.(draftSteps);
  }, [draftSteps]);

  const updateField = (stepId: string, fieldId: string, value: string) => {
    setDraftSteps((prev) =>
      updateSteps(prev, stepId, (step) => {
        let nextFields = step.fields.map((field) =>
          field.id === fieldId ? { ...field, value } : field,
        );
        if (step.type === 'wait' && fieldId === 'mode' && value === 'time') {
          const durationIndex = nextFields.findIndex((field) => field.id === 'duration');
          if (durationIndex === -1) {
            nextFields = [
              ...nextFields,
              {
                id: 'duration',
                label: 'Duration (ms)',
                placeholder: '1200',
                type: 'number',
                value: '1200',
                showWhen: { fieldId: 'mode', value: 'time' },
              },
            ];
          } else if (!nextFields[durationIndex].value) {
            nextFields = nextFields.map((field, index) =>
              index === durationIndex ? { ...field, value: '1200' } : field,
            );
          }
        }
        const nextStep = { ...step, fields: nextFields };
        if (step.type === 'data-source' && fieldId === 'headerRow' && step.dataSource?.rawText) {
          const sourceType = step.dataSource?.fileType || 'csv';
          const headerRow = nextFields.find((field) => field.id === 'headerRow')?.value;
          const hasHeader = headerRow ? headerRow === 'true' : true;
          const meta = parseDataSourceMeta(step.dataSource.rawText, sourceType, hasHeader);
          return {
            ...nextStep,
            summary: buildDataSourceSummary(meta.columns, meta.rowCount, meta.error),
            dataSource: {
              ...step.dataSource,
              columns: meta.columns,
              rowCount: meta.rowCount,
              error: meta.error,
            },
          };
        }
        return {
          ...nextStep,
          summary: summarizeStep(nextStep),
        };
      }),
    );
  };

  const addStep = (
    type: string,
    target:
      | { scope: 'root' }
      | { scope: 'children'; stepId: string }
      | { scope: 'branch'; stepId: string; branchId: string },
  ) => {
    const newStep = createStepTemplate(type, templateOptions);
    if (target.scope === 'root') {
      setDraftSteps((prev) => [...prev, newStep]);
      setActiveStepId(newStep.id);
      return;
    }
    setDraftSteps((prev) =>
      updateSteps(prev, target.stepId, (step) => {
        if (target.scope === 'children') {
          const nextChildren = [...(step.children ?? []), newStep];
          return { ...step, children: nextChildren };
        }
        if (target.scope === 'branch') {
          const nextBranches =
            step.branches?.map((branch) => {
              if (branch.id !== target.branchId) {
                return branch;
              }
              return { ...branch, steps: [...branch.steps, newStep] };
            }) ?? [];
          return { ...step, branches: nextBranches };
        }
        return step;
      }),
    );
    setActiveStepId(newStep.id);
  };

  const handleDeleteStep = (stepId: string) => {
    setDraftSteps((prev) => {
      const next = removeStepById(prev, stepId);
      setActiveStepId((current) => {
        if (current && findStepById(next, current)) {
          return current;
        }
        return '';
      });
      return next;
    });
    setTransformEditorTarget((prev) => (prev?.stepId === stepId ? null : prev));
  };

  const normalizeColumnToken = (column: string) => {
    const trimmed = column.trim();
    if (!trimmed) {
      return '';
    }
    const safeKey = /^[A-Za-z_][0-9A-Za-z_]*$/.test(trimmed);
    if (safeKey) {
      return `{{row.${trimmed}}}`;
    }
    const escaped = trimmed.replace(/"/g, '\\"');
    return `{{row["${escaped}"]}}`;
  };

  const insertColumnToken = (column: string, fallbackStepId?: string) => {
    const token = normalizeColumnToken(column);
    if (!token) {
      return;
    }
    if (fallbackStepId) {
      const newStep = createInputStepWithValue(token, templateOptions);
      setDraftSteps((prev) => {
        if (!findStepById(prev, fallbackStepId)) {
          return prev;
        }
        return updateSteps(prev, fallbackStepId, (step) => {
          const nextChildren = [...(step.children ?? []), newStep];
          return { ...step, children: nextChildren };
        });
      });
      setCollapsedSteps((prev) => ({
        ...prev,
        [fallbackStepId]: false,
      }));
      setActiveStepId(fallbackStepId);
      setActiveFieldTarget(null);
      return;
    }
    setDraftSteps((prev) => {
      const target = activeFieldTarget;
      if (!target) {
        return prev;
      }
      setActiveFieldTarget(target);
      setActiveStepId(target.stepId);
      return updateSteps(prev, target.stepId, (step) => {
        const nextFields = step.fields.map((field) => {
          if (field.id !== target.fieldId) {
            return field;
          }
          const nextValue = field.value ? `${field.value} ${token}` : token;
          return { ...field, value: nextValue };
        });
        const nextStep = { ...step, fields: nextFields };
        return { ...nextStep, summary: summarizeStep(nextStep) };
      });
    });
  };

  const insertInputValueShortcut = (stepId: string, fieldId: string, token: string) => {
    setDraftSteps((prev) =>
      updateSteps(prev, stepId, (step) => {
        const nextFields = step.fields.map((field) => {
          if (field.id !== fieldId) {
            return field;
          }
          const nextValue = field.value ? `${field.value} ${token}` : token;
          return { ...field, value: nextValue };
        });
        const nextStep = { ...step, fields: nextFields };
        return { ...nextStep, summary: summarizeStep(nextStep) };
      }),
    );
    setActiveStepId(stepId);
    setActiveFieldTarget({ stepId, fieldId });
  };

  const updateFieldTransform = (
    stepId: string,
    fieldId: string,
    updater: (
      current: NonNullable<StepField['transform']> | undefined,
    ) => StepField['transform'] | undefined,
  ) => {
    setDraftSteps((prev) =>
      updateSteps(prev, stepId, (step) => {
        const nextFields = step.fields.map((field) => {
          if (field.id !== fieldId) {
            return field;
          }
          return {
            ...field,
            transform: updater(field.transform),
          };
        });
        const nextStep = { ...step, fields: nextFields };
        return { ...nextStep, summary: summarizeStep(nextStep) };
      }),
    );
  };

  const ensureJsTransform = (current: StepField['transform']): NonNullable<StepField['transform']> => {
    if (current?.mode === 'js') {
      return current;
    }
    return {
      mode: 'js',
      code: 'return input;',
      enabled: true,
      timeoutMs: 300,
    };
  };

  const toggleTransformEditor = (stepId: string, fieldId: string) => {
    setTransformEditorTarget((prev) =>
      prev?.stepId === stepId && prev.fieldId === fieldId ? null : { stepId, fieldId },
    );
    updateFieldTransform(stepId, fieldId, (current) => ensureJsTransform(current));
    setActiveStepId(stepId);
    setActiveFieldTarget({ stepId, fieldId });
  };

  const applyTransformSnippet = (stepId: string, fieldId: string, code: string) => {
    updateFieldTransform(stepId, fieldId, (current) => ({
      ...ensureJsTransform(current),
      code,
      enabled: true,
    }));
    setActiveStepId(stepId);
    setActiveFieldTarget({ stepId, fieldId });
  };

  const handleDataSourceFileChange = (stepId: string, file: File | null) => {
    if (!file) {
      return;
    }
    const name = file.name.toLowerCase();
    const inferredType = name.endsWith('.tsv') ? 'tsv' : name.endsWith('.csv') ? 'csv' : '';
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setDraftSteps((prev) => {
        const step = findStepById(prev, stepId);
        if (!step) {
          return prev;
        }
        const sourceType = inferredType || step.dataSource?.fileType || 'csv';
        const headerRow = getFieldValue(step, 'headerRow');
        const hasHeader = headerRow ? headerRow === 'true' : true;
        const meta = parseDataSourceMeta(text, sourceType, hasHeader);
        return updateSteps(prev, stepId, (item) => ({
          ...item,
          summary: buildDataSourceSummary(meta.columns, meta.rowCount, meta.error),
          dataSource: {
            fileName: file.name,
            fileType: sourceType as 'csv' | 'tsv',
            columns: meta.columns,
            rowCount: meta.rowCount,
            error: meta.error,
            rawText: text,
          },
        }));
      });
    };
    reader.readAsText(file);
  };

  const renderStepList = (
    items: StepData[],
    depth = 0,
    options?: {
      context?: StepTreeContext;
      addPlaceholder?: { label: string; ariaLabel: string; onPick: (type: string) => void };
    },
  ) => {
    const listContext = options?.context;
    return (
    <div className={depth > 0 ? 'grid gap-2 border-l border-border/70 pl-3' : 'grid gap-2'}>
      {items.map((step, index) => {
        const isActive = step.id === activeStepId;
        const isLoop = step.type === 'loop';
        const isIfElse = step.type === 'if-else';
        const isDataSource = step.type === 'data-source';
        const isCollapsed = collapsedSteps[step.id] ?? (isDataSource ? true : false);
        const dataSourceCount = isDataSource ? step.children?.length ?? 0 : 0;
        const dataSourceMeta = step.dataSource;
        const typeLabel = stepTypeLabels[step.type] ?? step.type;
        const isDragging = dragState?.stepId === step.id;
        const canDropHere = dragState && listContext ? isSameContext(dragState.context, listContext) : false;
        const handleDrop = () => {
          if (!dragState || !listContext || !canDropHere || dragState.stepId === step.id) {
            return;
          }
          setDraftSteps((prev) => reorderWithinContext(prev, listContext, dragState.stepId, step.id));
          setDragState(null);
        };
        return (
          <div
            key={step.id}
            className={`rounded-lg border border-border bg-card shadow-sm transition ${
              isDragging ? 'opacity-60' : ''
            }`}
            onDragOver={(event) => {
              if (!canDropHere || dragState?.stepId === step.id) {
                return;
              }
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(event) => {
              if (!canDropHere || dragState?.stepId === step.id) {
                return;
              }
              event.preventDefault();
              handleDrop();
            }}
          >
            <div
              role="button"
              tabIndex={0}
              className={`group flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${
                isActive ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => setActiveStepId(isActive ? '' : step.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setActiveStepId(isActive ? '' : step.id);
                }
              }}
              draggable={Boolean(listContext)}
              onDragStart={(event) => {
                if (!listContext) {
                  return;
                }
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', step.id);
                setDragState({ stepId: step.id, context: listContext });
              }}
              onDragEnd={() => setDragState(null)}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold text-foreground">
                    {index + 1}
                  </span>
                  <p className="min-w-0 truncate text-xs font-semibold text-foreground">{step.title}</p>
                  <span className="badge-pill shrink-0 text-[9px] uppercase tracking-wide">{typeLabel}</span>
                </div>
                <p className="mt-1 min-w-0 max-w-full break-all text-[11px] text-muted-foreground">
                  {step.summary}
                </p>
              </div>
              <button
                type="button"
                className="btn-icon btn-icon-danger ml-auto h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={t('sidepanel_steps_delete', 'Delete step')}
                onClick={(event) => {
                  event.stopPropagation();
                  handleDeleteStep(step.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {isActive ? (
              <div className="px-3 pb-3">
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  {(() => {
                    const visibleFields = step.fields
                      .filter((field) => shouldShowField(step, field))
                      .filter((field) => !(isDataSource && field.id === 'headerRow'));
                    if (step.type !== 'wait') {
                      return visibleFields.map((field) => {
                        const useLabelWrapper = !(step.type === 'input' && field.id === 'value');
                        const FieldWrapper = (useLabelWrapper ? 'label' : 'div') as 'label' | 'div';
                        return (
                        <FieldWrapper key={field.id} className="grid gap-1">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {getFieldLabel(field.label)}
                          </span>
                          <div className="flex min-w-0 items-center gap-2">
                            {(() => {
                              if (step.type === 'input' && field.id === 'value') {
                                const hasTransform = Boolean(
                                  field.transform?.mode === 'js' && field.transform.code.trim(),
                                );
                                const inputValueModeKey = `${step.id}:${field.id}`;
                                const inputValueMode =
                                  inputValueModes[inputValueModeKey] ??
                                  (isSecretTokenValue(field.value) ? 'secret' : 'literal');
                                const showInputValueShortcuts = inputValueMode === 'literal';
                                const transformEditorOpen =
                                  transformEditorTarget?.stepId === step.id &&
                                  transformEditorTarget.fieldId === field.id;
                                const transformConfig = ensureJsTransform(field.transform);
                                return (
                                  <div className="grid w-full gap-1.5">
                                    <InputSecretValueControl
                                      step={step}
                                      field={field}
                                      onUpdateField={updateField}
                                      onModeChange={(mode) =>
                                        setInputValueModes((current) =>
                                          current[inputValueModeKey] === mode
                                            ? current
                                            : { ...current, [inputValueModeKey]: mode },
                                        )
                                      }
                                      setFieldInputRef={setFieldInputRef}
                                      onFocusField={(stepId, fieldId) =>
                                        setActiveFieldTarget({ stepId, fieldId })
                                      }
                                    />
                                    {showInputValueShortcuts ? (
                                      <div className="flex flex-wrap items-center gap-1">
                                        {inputValueShortcuts.map((shortcut) => {
                                          const Icon = shortcut.icon;
                                          return (
                                            <button
                                              key={shortcut.id}
                                              type="button"
                                              className="btn-icon h-7 w-7"
                                              title={shortcut.label}
                                              aria-label={shortcut.label}
                                              onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                insertInputValueShortcut(step.id, field.id, shortcut.token);
                                              }}
                                            >
                                              <Icon className="h-3.5 w-3.5" />
                                            </button>
                                          );
                                        })}
                                        <button
                                          type="button"
                                          className={`btn-icon h-7 w-7 ${hasTransform || transformEditorOpen ? 'bg-primary/15 text-primary' : ''}`}
                                          title={t('sidepanel_step_input_transform_edit', 'Edit JS transform')}
                                          aria-label={t('sidepanel_step_input_transform_edit', 'Edit JS transform')}
                                          onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            toggleTransformEditor(step.id, field.id);
                                          }}
                                        >
                                          <Code2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ) : null}
                                    {showInputValueShortcuts && transformEditorOpen ? (
                                      <div className="grid gap-2 rounded-md border border-border bg-muted/30 p-2">
                                        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                          <input
                                            type="checkbox"
                                            className="h-3.5 w-3.5"
                                            checked={transformConfig.enabled !== false}
                                            onChange={(event) =>
                                              updateFieldTransform(step.id, field.id, (current) => ({
                                                ...ensureJsTransform(current),
                                                enabled: event.target.checked,
                                              }))
                                            }
                                          />
                                          <span>
                                            {t(
                                              'sidepanel_step_input_transform_enabled',
                                              'Enable JS transform at runtime',
                                            )}
                                          </span>
                                        </label>
                                        <div className="flex flex-wrap items-center gap-1">
                                          {transformCodeShortcuts.map((shortcut) => {
                                            const Icon = shortcut.icon;
                                            return (
                                              <button
                                                key={shortcut.id}
                                                type="button"
                                                className="btn-icon h-7 w-7"
                                                title={shortcut.label}
                                                aria-label={shortcut.label}
                                                onClick={(event) => {
                                                  event.preventDefault();
                                                  event.stopPropagation();
                                                  applyTransformSnippet(step.id, field.id, shortcut.code);
                                                }}
                                              >
                                                <Icon className="h-3.5 w-3.5" />
                                              </button>
                                            );
                                          })}
                                        </div>
                                        <textarea
                                          className="input h-24 min-w-0 font-mono text-[11px]"
                                          value={transformConfig.code}
                                          onChange={(event) =>
                                            updateFieldTransform(step.id, field.id, (current) => ({
                                              ...ensureJsTransform(current),
                                              code: event.target.value,
                                            }))
                                          }
                                          placeholder="return input;"
                                        />
                                        <label className="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-2 text-[11px] text-muted-foreground">
                                          <span>{t('sidepanel_step_input_transform_timeout', 'Timeout (ms)')}</span>
                                          <input
                                            className="input h-8 min-w-0"
                                            type="number"
                                            min={50}
                                            max={5000}
                                            value={String(transformConfig.timeoutMs ?? 300)}
                                            onChange={(event) =>
                                              updateFieldTransform(step.id, field.id, (current) => {
                                                const parsed = Number.parseInt(event.target.value, 10);
                                                const timeoutMs =
                                                  Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
                                                return {
                                                  ...ensureJsTransform(current),
                                                  timeoutMs,
                                                };
                                              })
                                            }
                                          />
                                        </label>
                                        <p className="text-[10px] text-muted-foreground">
                                          {t(
                                            'sidepanel_step_input_transform_hint',
                                            'Use input, row, now, helpers and return the final string.',
                                          )}
                                        </p>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              }
                              return (
                                <StepFieldControl
                                  step={step}
                                  field={{ ...field, options: resolveFieldOptions(step, field) }}
                                  onUpdateField={updateField}
                                  setFieldInputRef={setFieldInputRef}
                                  onFocusField={(stepId, fieldId) => setActiveFieldTarget({ stepId, fieldId })}
                                  onStartPicker={onStartPicker}
                                />
                              );
                            })()}
                          </div>
                        </FieldWrapper>
                      )});
                    }
                    const rendered: ReactNode[] = [];
                    const expectedField = visibleFields.find((field) => field.id === 'expected');
                    const durationField = visibleFields.find((field) => field.id === 'duration');
                    visibleFields.forEach((field) => {
                      if (field.id === 'expected') {
                        return;
                      }
                      if (field.id === 'duration') {
                        return;
                      }
                      if (field.id === 'mode' && durationField) {
                        rendered.push(
                          <div
                            key="mode-duration"
                            className="grid gap-2 sm:grid-cols-[auto,minmax(0,1fr),auto,minmax(0,1fr)] sm:items-center"
                          >
                            <span className="text-xs font-semibold text-muted-foreground sm:whitespace-nowrap">
                              {getFieldLabel(field.label)}
                            </span>
                            <SelectMenu
                              value={field.value}
                              options={resolveFieldOptions(step, field) ?? []}
                              useInputStyle={false}
                              buttonClassName="btn-ghost h-9 w-full min-w-0 justify-between px-2 text-xs"
                              onChange={(value) => updateField(step.id, field.id, value)}
                            />
                            <span className="text-xs font-semibold text-muted-foreground sm:whitespace-nowrap">
                              {getFieldLabel(durationField.label)}
                            </span>
                            <input
                              ref={setFieldInputRef(step.id, durationField.id)}
                              data-flow-step-id={step.id}
                              data-flow-field-id={durationField.id}
                              className="input w-full min-w-0"
                              type="number"
                              value={durationField.value}
                              onChange={(event) => updateField(step.id, durationField.id, event.target.value)}
                              placeholder={durationField.placeholder}
                              onFocus={() => setActiveFieldTarget({ stepId: step.id, fieldId: durationField.id })}
                            />
                          </div>,
                        );
                        return;
                      }
                      if (field.id === 'operator' && expectedField) {
                        rendered.push(
                          <div key="operator-expected" className="grid gap-1">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {t('sidepanel_step_condition_label', 'Condition')}
                          </span>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <SelectMenu
                                value={field.value}
                                options={resolveFieldOptions(step, field) ?? []}
                                useInputStyle={false}
                                buttonClassName="btn-ghost h-9 w-full min-w-0 justify-between px-2 text-xs"
                                onChange={(value) => updateField(step.id, field.id, value)}
                              />
                              <input
                                ref={setFieldInputRef(step.id, expectedField.id)}
                                data-flow-step-id={step.id}
                                data-flow-field-id={expectedField.id}
                                className="input min-w-0"
                                type="text"
                                value={expectedField.value}
                                onChange={(event) => updateField(step.id, expectedField.id, event.target.value)}
                                placeholder={expectedField.placeholder}
                                onFocus={() => setActiveFieldTarget({ stepId: step.id, fieldId: expectedField.id })}
                              />
                            </div>
                          </div>,
                        );
                        return;
                      }
                      rendered.push(
                        <label key={field.id} className="grid gap-1">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {getFieldLabel(field.label)}
                          </span>
                          <div className="flex min-w-0 items-center gap-2">
                            <StepFieldControl
                              step={step}
                              field={{ ...field, options: resolveFieldOptions(step, field) }}
                              onUpdateField={updateField}
                              setFieldInputRef={setFieldInputRef}
                              onFocusField={(stepId, fieldId) => setActiveFieldTarget({ stepId, fieldId })}
                              onStartPicker={onStartPicker}
                            />
                          </div>
                        </label>,
                      );
                    });
                    return rendered;
                  })()}
                  {isDataSource ? (
                    <div className="grid gap-2">
                      <label className="grid gap-1">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {t('sidepanel_steps_file_label', 'File')}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="btn-ghost h-9 cursor-pointer px-3 text-xs">
                            {t('sidepanel_steps_choose_file', 'Choose file')}
                            <input
                              type="file"
                              accept=".csv,.tsv,text/csv,text/tab-separated-values"
                              className="hidden"
                              onChange={(event) =>
                                handleDataSourceFileChange(step.id, event.target.files?.[0] ?? null)
                              }
                            />
                          </label>
                          <span className="text-[11px] text-muted-foreground">
                            {dataSourceMeta?.fileName ||
                              t('sidepanel_steps_no_file_selected', 'No file selected')}
                          </span>
                        </div>
                        {dataSourceMeta?.error ? (
                          <span className="text-[11px] text-destructive">{dataSourceMeta.error}</span>
                        ) : null}
                      </label>
                      {dataSourceMeta?.fileName ? (
                        <label className="flex items-center gap-2 text-xs text-foreground">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={getFieldValue(step, 'headerRow') === 'true'}
                            onChange={(event) =>
                              updateField(step.id, 'headerRow', event.target.checked ? 'true' : 'false')
                            }
                          />
                          <span className="text-xs font-semibold text-muted-foreground">
                            {t('sidepanel_steps_header_row', 'Header row')}
                          </span>
                        </label>
                      ) : null}
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                          <span>{t('sidepanel_steps_columns', 'Columns')}</span>
                          <span>
                            {dataSourceMeta?.columns?.length
                              ? t('sidepanel_steps_columns_count', '{count} cols').replace(
                                  '{count}',
                                  String(dataSourceMeta.columns.length),
                                )
                              : t('sidepanel_steps_columns_na', 'N/A')}
                          </span>
                        </div>
                        {dataSourceMeta?.columns && dataSourceMeta.columns.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {dataSourceMeta.columns.map((column) => (
                              <button
                                key={column}
                                type="button"
                                className="btn-ghost h-7 px-2 text-[10px]"
                                onClick={() => insertColumnToken(column, step.id)}
                                title={t('sidepanel_steps_insert_column', 'Insert {column}').replace('{column}', column)}
                              >
                                {column}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            {t('sidepanel_steps_columns_empty', 'Select a file to load columns.')}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {t('sidepanel_steps_columns_hint', 'Click a column to create an Input step with')}
                          <span> </span>
                          <code>{'{{row.column}}'}</code>.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {isLoop || isDataSource ? (
              <div className="px-3 pb-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"
                    onClick={() =>
                      setCollapsedSteps((prev) => ({
                        ...prev,
                        [step.id]: !isCollapsed,
                      }))
                    }
                  >
                    <ChevronRight className={`h-3 w-3 transition ${isCollapsed ? '' : 'rotate-90'}`} />
                    <span>
                      {isDataSource
                        ? t('sidepanel_steps_per_row', 'Steps per row')
                        : t('sidepanel_steps_in_loop', 'Steps in loop')}
                    </span>
                  </button>
                  {isDataSource ? (
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {t('sidepanel_steps_count', '{count} steps')
                        .replace('{count}', String(dataSourceCount))}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {t('sidepanel_steps_count', '{count} steps')
                        .replace('{count}', String(step.children?.length ?? 0))}
                    </span>
                  )}
                </div>
                {!isCollapsed ? (
                  <div className="mt-2">
                    {renderStepList(step.children ?? [], depth + 1, {
                      context: { scope: 'children', parentId: step.id },
                      addPlaceholder: {
                        label: isDataSource
                          ? t('sidepanel_steps_add_per_row', 'Add step per row')
                          : t('sidepanel_steps_add_in_loop', 'Add step in loop'),
                        ariaLabel: isDataSource
                          ? t('sidepanel_steps_add_to_data_source', 'Add step to data source')
                          : t('sidepanel_steps_add_to_loop', 'Add step to loop'),
                        onPick: (type) => addStep(type, { scope: 'children', stepId: step.id }),
                      },
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
            {isIfElse && step.branches?.length ? (
              <div className="px-3 pb-3">
                {step.branches.map((branch) => {
                  const branchLabel = getBranchLabel(branch.id, branch.label);
                  return (
                    <div key={branch.id} className="mt-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                        <button
                          type="button"
                          className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"
                          onClick={() =>
                            setCollapsedBranches((prev) => ({
                              ...prev,
                              [`${step.id}:${branch.id}`]:
                                !(prev[`${step.id}:${branch.id}`] ?? false),
                            }))
                          }
                        >
                          <ChevronRight
                            className={`h-3 w-3 transition ${
                              collapsedBranches[`${step.id}:${branch.id}`] ? '' : 'rotate-90'
                            }`}
                          />
                          <span>{branchLabel}</span>
                        </button>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {t('sidepanel_steps_count', '{count} steps')
                            .replace('{count}', String(branch.steps.length))}
                        </span>
                      </div>
                      {!collapsedBranches[`${step.id}:${branch.id}`] ? (
                        <div className="mt-2">
                          {renderStepList(branch.steps ?? [], depth + 1, {
                            context: { scope: 'branch', parentId: step.id, branchId: branch.id },
                            addPlaceholder: {
                              label: t('sidepanel_steps_add_to_branch', 'Add step to {label}').replace(
                                '{label}',
                                branchLabel,
                              ),
                              ariaLabel: t('sidepanel_steps_add_to_branch', 'Add step to {label}').replace(
                                '{label}',
                                branchLabel,
                              ),
                              onPick: (type) =>
                                addStep(type, { scope: 'branch', stepId: step.id, branchId: branch.id }),
                            },
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
      {options?.addPlaceholder ? (
        <AddStepPlaceholder
          label={options.addPlaceholder.label}
          ariaLabel={options.addPlaceholder.ariaLabel}
          onPick={options.addPlaceholder.onPick}
          canDrop={dragState && listContext ? isSameContext(dragState.context, listContext) : false}
          onDropReorder={() => {
            const dropContext = listContext;
            if (!dragState || !dropContext) {
              return;
            }
            setDraftSteps((prev) => reorderWithinContext(prev, dropContext, dragState.stepId));
            setDragState(null);
          }}
        />
      ) : null}
    </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          {t('sidepanel_steps_title', 'Steps')}
        </span>
      </div>
      <div className="max-h-[35.5vh] overflow-x-hidden overflow-y-auto pr-1" data-step-scroll>
        {renderStepList(draftSteps, 0, {
          context: { scope: 'root' },
          addPlaceholder: {
            label: t('sidepanel_steps_add', 'Add step'),
            ariaLabel: t('sidepanel_steps_add', 'Add step'),
            onPick: (type) => addStep(type, { scope: 'root' }),
          },
        })}
      </div>
    </div>
  );
}

