/**
 * Creates a section shell with shared styling and a flex-wrap container.
 * @param {{ legendText: string }} options
 * @returns {{ fieldset: HTMLFieldSetElement; legend: HTMLLegendElement; container: HTMLDivElement }}
 */
export function createSectionShell({ legendText }) {
  const fieldset = document.createElement('fieldset');
  Object.assign(fieldset.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '14px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    borderRadius: '16px',
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
  });

  const legend = document.createElement('legend');
  legend.textContent = legendText;
  Object.assign(legend.style, {
    fontSize: '13px',
    fontWeight: '700',
    color: '#6b7280',
    padding: '0 6px',
  });
  fieldset.appendChild(legend);

  const container = document.createElement('div');
  Object.assign(container.style, {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    alignItems: 'stretch',
  });

  return { fieldset, legend, container };
}
