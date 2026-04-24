import type { FlowStepData } from '../../../shared/flowStepMigration';
import { getStepFieldRawValue, toNonNegativeInteger } from './tokenRenderer';

export const estimateFlowStep = (step: FlowStepData): number => {
  if (
    step.type === 'click' ||
    step.type === 'input' ||
    step.type === 'wait' ||
    step.type === 'assert' ||
    step.type === 'popup' ||
    step.type === 'navigate' ||
    step.type === 'set-variable'
  ) {
    return 1;
  }
  if (step.type === 'loop') {
    const iterations = toNonNegativeInteger(getStepFieldRawValue(step, 'iterations'), 0);
    return iterations * estimateFlowSteps(step.children ?? []);
  }
  if (step.type === 'if-else') {
    const { thenSteps, elseSteps } = selectIfElseBranches(step);
    return 1 + Math.max(estimateFlowSteps(thenSteps), estimateFlowSteps(elseSteps));
  }
  if (step.type === 'data-source') {
    const rowEstimate =
      typeof step.dataSource?.rowCount === 'number' && Number.isFinite(step.dataSource.rowCount)
        ? Math.max(0, step.dataSource.rowCount)
        : 1;
    return rowEstimate * estimateFlowSteps(step.children ?? []);
  }
  return 1;
};

export const estimateFlowSteps = (steps: FlowStepData[]) =>
  steps.reduce((total, step) => total + estimateFlowStep(step), 0);

export const normalizeDelimitedText = (value: string) =>
  value.replace(/\r\n?/g, '\n').replace(/\n+$/, '');

export const collectDataSourceStepIds = (steps: FlowStepData[], sink: string[] = []) => {
  for (const step of steps) {
    if (step.type === 'data-source') {
      sink.push(step.id);
    }
    if (Array.isArray(step.children) && step.children.length > 0) {
      collectDataSourceStepIds(step.children, sink);
    }
    if (Array.isArray(step.branches) && step.branches.length > 0) {
      for (const branch of step.branches) {
        collectDataSourceStepIds(branch.steps ?? [], sink);
      }
    }
  }
  return sink;
};

export const selectIfElseBranches = (step: FlowStepData) => {
  const branches = Array.isArray(step.branches) ? step.branches : [];
  const matchBy = (keyword: string) =>
    branches.find((branch) => `${branch.id} ${branch.label}`.toLowerCase().includes(keyword));
  const thenBranch = matchBy('then') || branches[0];
  const elseBranch =
    matchBy('else') || branches.find((branch) => branch !== thenBranch) || branches[1];
  return {
    thenSteps: thenBranch?.steps ?? [],
    elseSteps: elseBranch?.steps ?? [],
  };
};
