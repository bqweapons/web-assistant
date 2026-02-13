import type { StepData } from './types';

export type StepTreeContext =
  | { scope: 'root' }
  | { scope: 'children'; parentId: string }
  | { scope: 'branch'; parentId: string; branchId: string };

export const isSameContext = (left: StepTreeContext, right: StepTreeContext) => {
  if (left.scope !== right.scope) {
    return false;
  }
  if (left.scope === 'root' && right.scope === 'root') {
    return true;
  }
  if (left.scope === 'children' && right.scope === 'children') {
    return left.parentId === right.parentId;
  }
  if (left.scope === 'branch' && right.scope === 'branch') {
    return left.parentId === right.parentId && left.branchId === right.branchId;
  }
  return false;
};

export const findStepById = (items: StepData[], stepId: string): StepData | undefined => {
  for (const step of items) {
    if (step.id === stepId) {
      return step;
    }
    if (step.children?.length) {
      const match = findStepById(step.children, stepId);
      if (match) {
        return match;
      }
    }
    if (step.branches?.length) {
      for (const branch of step.branches) {
        const match = findStepById(branch.steps, stepId);
        if (match) {
          return match;
        }
      }
    }
  }
  return undefined;
};

export const updateSteps = (items: StepData[], stepId: string, updater: (step: StepData) => StepData) =>
  items.map((step) => {
    if (step.id === stepId) {
      return updater(step);
    }
    let nextStep = step;
    if (step.children?.length) {
      const nextChildren = updateSteps(step.children, stepId, updater);
      if (nextChildren !== step.children) {
        nextStep = { ...nextStep, children: nextChildren };
      }
    }
    if (step.branches?.length) {
      let branchesChanged = false;
      const nextBranches = step.branches.map((branch) => {
        const nextBranchSteps = updateSteps(branch.steps, stepId, updater);
        if (nextBranchSteps !== branch.steps) {
          branchesChanged = true;
          return { ...branch, steps: nextBranchSteps };
        }
        return branch;
      });
      if (branchesChanged) {
        nextStep = { ...nextStep, branches: nextBranches };
      }
    }
    return nextStep;
  });

const reorderList = (items: StepData[], fromId: string, toId?: string) => {
  const fromIndex = items.findIndex((item) => item.id === fromId);
  if (fromIndex === -1) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!toId) {
    next.push(moved);
    return next;
  }
  const targetIndex = next.findIndex((item) => item.id === toId);
  if (targetIndex === -1) {
    next.push(moved);
    return next;
  }
  next.splice(targetIndex, 0, moved);
  return next;
};

export const reorderWithinContext = (
  items: StepData[],
  context: StepTreeContext,
  fromId: string,
  toId?: string,
) => {
  if (context.scope === 'root') {
    return reorderList(items, fromId, toId);
  }
  return updateSteps(items, context.parentId, (step) => {
    if (context.scope === 'children') {
      const nextChildren = reorderList(step.children ?? [], fromId, toId);
      return { ...step, children: nextChildren };
    }
    const nextBranches =
      step.branches?.map((branch) => {
        if (branch.id !== context.branchId) {
          return branch;
        }
        return { ...branch, steps: reorderList(branch.steps, fromId, toId) };
      }) ?? [];
    return { ...step, branches: nextBranches };
  });
};

export const removeStepById = (items: StepData[], stepId: string) => {
  const next: StepData[] = [];
  for (const step of items) {
    if (step.id === stepId) {
      continue;
    }
    let nextStep = step;
    if (step.children?.length) {
      const nextChildren = removeStepById(step.children, stepId);
      nextStep = { ...nextStep, children: nextChildren };
    }
    if (step.branches?.length) {
      const nextBranches = step.branches.map((branch) => ({
        ...branch,
        steps: removeStepById(branch.steps, stepId),
      }));
      nextStep = { ...nextStep, branches: nextBranches };
    }
    next.push(nextStep);
  }
  return next;
};
