import { describe, expect, it } from 'vitest';
import { isFlowStepData, normalizeFlowSteps } from '../../shared/flowStepMigration';

const ids = () => {
  let n = 0;
  return (prefix: string) => `${prefix}-${(n += 1)}`;
};

describe('normalizeFlowSteps', () => {
  it('keeps legacy numeric step counts when asked', () => {
    expect(normalizeFlowSteps(3)).toBe(3);
    expect(normalizeFlowSteps(3, { keepNumber: false })).toEqual([]);
  });

  it('converts legacy actions, maps open/goto to navigate, drops unknown types', () => {
    const steps = normalizeFlowSteps(
      [
        { type: 'click', selector: '#go' },
        { type: 'goto', url: 'https://example.com' },
        { type: '__proto__', selector: '#x' },
        { type: 'mystery' },
      ],
      { flowId: 'f', idFactory: ids() },
    ) as ReturnType<typeof normalizeFlowSteps> & unknown[];
    expect(Array.isArray(steps)).toBe(true);
    const list = steps as Exclude<typeof steps, number>;
    expect(list.map((s) => s.type)).toEqual(['click', 'navigate']);
    expect(list.every((s) => isFlowStepData(s))).toBe(true);
    expect(list[0].fields.find((f) => f.id === 'selector')?.value).toBe('#go');
  });

  it('returns current-format steps unchanged', () => {
    const current = [{ id: 's1', type: 'click', title: 'Click', summary: '', fields: [] }];
    expect(normalizeFlowSteps(current)).toBe(current);
  });
});
