import { describe, expect, it } from 'vitest';
import { createStepTemplate } from '../../ui/sidepanel/components/flowSteps/templates';

const options = {
  waitModes: [{ value: 'time', label: 'Time' }],
  conditionOperators: [
    { value: 'contains', label: 'contains' },
    { value: 'equals', label: 'equals' },
  ],
};

describe('createStepTemplate', () => {
  it.each(['if-else', 'assert', 'wait'])('%s starts without example values', (type) => {
    const step = createStepTemplate(type, options);
    for (const id of ['selector', 'expected']) {
      const field = step.fields.find((f) => f.id === id);
      if (field) {
        expect(field.value, `${type}.${id}`).toBe('');
      }
    }
    expect(step.summary).not.toMatch(/\.status|Ready/);
  });

  it('click summary says the selector is not set', () => {
    expect(createStepTemplate('click', options).summary).toMatch(/Not set/);
  });
});
