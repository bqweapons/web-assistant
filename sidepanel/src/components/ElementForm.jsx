import React, { useMemo, useState } from 'react';
import { summarizeFlow } from '../utils/messages.js';
import { STYLE_PALETTE, STYLE_PRESETS, buildStyleState, detectStylePreset, getStyleFieldConfigs } from '../element-form.js';

const FORM_CONTAINER_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  flex: '1 1 auto',
  minHeight: '0px',
  padding: '4px 2px 2px',
};

const SECTION_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const FIELDSET_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  padding: '5px',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  borderRadius: '16px',
  backgroundColor: 'rgba(248, 250, 252, 0.85)',
};

const LEGEND_STYLE = {
  fontSize: '13px',
  fontWeight: '700',
  color: 'rgb(107, 114, 128)',
  padding: '0px 6px',
};

const FIELD_ROW_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  alignItems: 'stretch',
};

const LABEL_TEXT_STYLE = {
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  color: 'rgb(100, 116, 139)',
};

const INPUT_STYLE = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '10px',
  border: '1px solid rgba(148, 163, 184, 0.6)',
  backgroundColor: 'rgba(241, 245, 249, 0.6)',
  fontSize: '13px',
  color: 'rgb(15, 23, 42)',
  outline: 'none',
  boxSizing: 'border-box',
  boxShadow: 'none',
};

const SELECT_STYLE = { ...INPUT_STYLE };

const COLOR_INPUT_STYLE = {
  width: '42px',
  height: '36px',
  padding: '0px',
  borderRadius: '10px',
  border: 'none',
  background: 'rgb(255, 255, 255)',
  cursor: 'pointer',
};

const PALETTE_STYLE = {
  display: 'flex',
  gap: '6px',
  flexWrap: 'wrap',
  marginTop: '4px',
};

const PALETTE_BUTTON_STYLE = {
  width: '18px',
  height: '18px',
  borderRadius: '6px',
  border: '1px solid rgba(148, 163, 184, 0.6)',
  cursor: 'pointer',
};

const INLINE_ROW_STYLE = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
};

const ADJUST_BUTTON_STYLE = {
  width: '28px',
  height: '28px',
  borderRadius: '8px',
  border: '1px solid rgba(148, 163, 184, 0.6)',
  background: 'rgb(255, 255, 255)',
  color: 'rgb(15, 23, 42)',
  cursor: 'pointer',
};

const NOTE_STYLE = {
  margin: '0px',
  fontSize: '11px',
  color: 'rgb(148, 163, 184)',
  flex: '1 1 100%',
  display: 'flex',
};

const DETAILS_STYLE = {
  borderTop: '1px solid rgba(226, 232, 240, 0.6)',
  paddingTop: '8px',
};

const SUMMARY_STYLE = {
  fontSize: '12px',
  fontWeight: '600',
  color: 'rgb(71, 85, 105)',
  cursor: 'pointer',
  marginBottom: '8px',
};

const ADVANCED_HINT_STYLE = {
  margin: '6px 0px 0px',
  fontSize: '11px',
  color: 'rgb(148, 163, 184)',
};

const ACTION_FLOW_STACK_STYLE = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  gap: '12px',
  flexDirection: 'column',
};

const ACTION_FLOW_TEXT_STYLE = {
  fontSize: '13px',
  color: 'rgb(15, 23, 42)',
  flex: '1 1 auto',
  lineHeight: '1.4',
  whiteSpace: 'pre-wrap',
};

const ACTION_FLOW_BUTTON_STYLE = {
  padding: '7px 12px',
  borderRadius: '8px',
  border: '1px solid rgba(99, 102, 241, 0.35)',
  background: 'linear-gradient(135deg, rgb(99, 102, 241), rgb(139, 92, 246))',
  color: 'rgb(255, 255, 255)',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
  boxShadow: '0px 4px 12px rgba(99, 102, 241, 0.25)',
  whiteSpace: 'nowrap',
  alignSelf: 'flex-start',
};

const TOGGLE_ROW_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer',
  fontWeight: '500',
};

const TOGGLE_HINT_STYLE = {
  margin: '4px 0px 0px',
  fontSize: '11px',
  color: 'rgb(148, 163, 184)',
};

const CHECKBOX_STYLE = {
  width: '16px',
  height: '16px',
  margin: '0px',
  cursor: 'pointer',
  borderRadius: '4px',
  border: '1px solid rgba(148, 163, 184, 0.6)',
  accentColor: 'rgb(37, 99, 235)',
};

const POSITION_OPTIONS = ['relative', 'absolute', 'fixed', 'static', 'sticky'];

function buildLabelStyle(minWidth, hidden) {
  return {
    display: hidden ? 'none' : 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontWeight: '500',
    color: 'rgb(15, 23, 42)',
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    borderRadius: '12px',
    padding: '4px 12px',
    boxSizing: 'border-box',
    flex: `1 1 ${minWidth}px`,
    minWidth: `${minWidth}px`,
  };
}

function resolveColorValue(value, placeholder) {
  if (value && value.startsWith('#')) {
    return value;
  }
  if (placeholder && placeholder.startsWith('#')) {
    return placeholder;
  }
  return '#ffffff';
}

export function ElementForm({
  value,
  onChange,
  t,
  onEditFlow,
  actionFlowSource,
  showScope = true,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customCss, setCustomCss] = useState('');

  const styleFields = useMemo(() => getStyleFieldConfigs(t), [t]);
  const basicStyleFields = useMemo(() => styleFields.filter((field) => field.group !== 'advanced'), [styleFields]);
  const advancedStyleFields = useMemo(() => styleFields.filter((field) => field.group === 'advanced'), [styleFields]);

  const styleState = value?.style || buildStyleState({}, t);

  const update = (patch) => {
    const next = { ...value, ...patch };
    if (!next.style) {
      next.style = buildStyleState({}, t);
    }
    onChange?.(next);
  };

  const updateStylePatch = (patch) => {
    const nextStyle = { ...styleState, ...patch };
    const nextPreset = detectStylePreset(nextStyle);
    update({ stylePreset: nextPreset, style: nextStyle });
  };

  const updateStyleValue = (name, fieldValue) => {
    updateStylePatch({ [name]: fieldValue || '' });
  };

  const applyPreset = (presetValue) => {
    const preset = STYLE_PRESETS.find((option) => option.value === presetValue);
    const blank = buildStyleState({}, t);
    let nextStyle = { ...blank };
    if (preset?.styles) {
      nextStyle = { ...nextStyle, ...preset.styles };
    }
    update({ stylePreset: presetValue, style: nextStyle || blank });
  };

  const handleCustomCssChange = (event) => {
    const text = event.target.value || '';
    setCustomCss(text);
    const updates = {};
    text
      .split(';')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((decl) => {
        const idx = decl.indexOf(':');
        if (idx === -1) return;
        const rawKey = decl.slice(0, idx).trim();
        const rawValue = decl.slice(idx + 1).trim();
        if (!rawKey || !rawValue) return;
        const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        if (Object.prototype.hasOwnProperty.call(styleState, key)) {
          updates[key] = rawValue;
        }
      });
    if (Object.keys(updates).length > 0) {
      updateStylePatch(updates);
    }
  };

  const isLink = value?.type === 'link';
  const isTooltip = value?.type === 'tooltip';
  const isArea = value?.type === 'area';
  const isButton = value?.type === 'button';
  const canToggleScope =
    showScope &&
    value?.siteUrl &&
    value?.pageUrl &&
    (value.siteUrl === value.pageUrl || `${value.siteUrl}/` === value.pageUrl);

  const hrefLabel =
    value?.type === 'tooltip'
      ? t('editor.hrefTooltipLabel')
      : value?.type === 'link'
        ? t('editor.hrefLabel')
        : t('editor.hrefOptionalLabel');

  const hrefPlaceholder =
    value?.type === 'tooltip' || value?.type === 'area'
      ? t('editor.hrefTooltipPlaceholder')
      : value?.type === 'link'
        ? t('editor.hrefPlaceholder')
        : t('editor.hrefOptionalPlaceholder');

  const flowSummary = summarizeFlow(actionFlowSource);
  const actionFlowText = value?.actionFlowLocked
    ? t('editor.actionFlowSummaryUnavailable')
    : flowSummary?.steps
      ? t('editor.actionFlowSummaryConfigured', { count: flowSummary.steps })
      : t('editor.actionFlowSummaryEmpty');

  const renderStyleField = (field) => {
    const name = field.key || field.name;
    if (!name) return null;
    const minWidth = typeof field.minWidth === 'number' ? field.minWidth : 260;
    const valueText = styleState[name] || '';
    const placeholder = field.placeholder || '';
    const isColor = Boolean(field.colorPicker);
    const isPosition = name === 'position';
    const isAdjustable = Boolean(field.adjustable);

    const handleAdjust = (delta) => {
      const numeric = parseInt((valueText || '').replace(/[^0-9-]/g, ''), 10);
      const fallback = name === 'fontWeight' ? 400 : 12;
      const nextNumber = Number.isFinite(numeric) ? numeric + delta : fallback + delta;
      const unit = name === 'fontWeight' ? '' : 'px';
      updateStyleValue(name, `${Math.max(0, nextNumber)}${unit}`);
    };

    return (
      <label key={name} style={buildLabelStyle(minWidth, false)}>
        <span style={LABEL_TEXT_STYLE}>{field.label}</span>
        <div style={INLINE_ROW_STYLE}>
          {isPosition ? (
            <>
              <select
                style={SELECT_STYLE}
                value={valueText || 'relative'}
                onChange={(event) => updateStyleValue(name, event.target.value)}
              >
                {POSITION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input type="text" style={{ ...INPUT_STYLE, display: 'none' }} placeholder="relative" />
            </>
          ) : (
            <input
              type="text"
              style={INPUT_STYLE}
              placeholder={placeholder}
              value={valueText}
              onChange={(event) => updateStyleValue(name, event.target.value)}
            />
          )}
          {isColor && (
            <input
              type="color"
              style={COLOR_INPUT_STYLE}
              value={resolveColorValue(valueText, placeholder)}
              onChange={(event) => updateStyleValue(name, event.target.value)}
            />
          )}
          {isAdjustable && (
            <>
              <button type="button" style={ADJUST_BUTTON_STYLE} onClick={() => handleAdjust(-1)}>
                -
              </button>
              <button type="button" style={ADJUST_BUTTON_STYLE} onClick={() => handleAdjust(1)}>
                +
              </button>
            </>
          )}
        </div>
        {isColor && (
          <div style={PALETTE_STYLE}>
            {STYLE_PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                style={{
                  ...PALETTE_BUTTON_STYLE,
                  background:
                    hex === 'transparent'
                      ? 'repeating-conic-gradient(rgb(203, 213, 225) 0%, rgb(203, 213, 225) 25%, rgb(241, 245, 249) 0%, rgb(241, 245, 249) 50%) 0px 0px / 8px 8px'
                      : hex,
                }}
                onClick={() => updateStyleValue(name, hex === 'transparent' ? '' : hex)}
              />
            ))}
          </div>
        )}
      </label>
    );
  };

  return (
    <div style={FORM_CONTAINER_STYLE}>
      <section style={SECTION_STYLE}>
        <fieldset style={FIELDSET_STYLE}>
          <legend style={LEGEND_STYLE}>{t('editor.sections.basics.title')}</legend>
          <div style={FIELD_ROW_STYLE}>
            <label style={buildLabelStyle(240, false)}>
              <span style={LABEL_TEXT_STYLE}>{t('editor.textLabel')}</span>
              <input
                type="text"
                placeholder={t('editor.textPlaceholder')}
                style={INPUT_STYLE}
                value={value?.text || ''}
                onChange={(event) => update({ text: event.target.value })}
              />
            </label>

            <label style={buildLabelStyle(240, false)}>
              <span style={LABEL_TEXT_STYLE}>{hrefLabel}</span>
              <input
                type="text"
                placeholder={hrefPlaceholder}
                style={INPUT_STYLE}
                value={value?.href || ''}
                onChange={(event) => update({ href: event.target.value })}
              />
            </label>

            <label style={buildLabelStyle(200, !isLink)}>
              <span style={LABEL_TEXT_STYLE}>{t('editor.linkTargetLabel')}</span>
              <select
                style={SELECT_STYLE}
                value={value?.linkTarget || 'new-tab'}
                onChange={(event) => update({ linkTarget: event.target.value })}
              >
                <option value="new-tab">{t('editor.linkTarget.newTab')}</option>
                <option value="same-tab">{t('editor.linkTarget.sameTab')}</option>
              </select>
            </label>

            <label style={buildLabelStyle(200, !canToggleScope)}>
              <span style={LABEL_TEXT_STYLE}>{t('editor.scopeLabel')}</span>
              <select
                style={SELECT_STYLE}
                value={value?.scope || 'page'}
                onChange={(event) => update({ scope: event.target.value === 'site' ? 'site' : 'page' })}
              >
                <option value="page">{t('editor.scope.page')}</option>
                <option value="site">{t('editor.scope.site')}</option>
              </select>
            </label>

            <label style={buildLabelStyle(240, !isButton)}>
              <span style={LABEL_TEXT_STYLE}>{t('editor.actionFlowLabel')}</span>
              <div style={ACTION_FLOW_STACK_STYLE}>
                <span style={ACTION_FLOW_TEXT_STYLE}>{actionFlowText}</span>
                <button
                  type="button"
                  style={{
                    ...ACTION_FLOW_BUTTON_STYLE,
                    opacity: value?.actionFlowLocked ? 0.5 : 1,
                    cursor: value?.actionFlowLocked ? 'not-allowed' : ACTION_FLOW_BUTTON_STYLE.cursor,
                  }}
                  onClick={() => {
                    if (!value?.actionFlowLocked) {
                      onEditFlow?.();
                    }
                  }}
                  disabled={value?.actionFlowLocked}
                >
                  {t('editor.actionFlowConfigure')}
                </button>
              </div>
            </label>

            <label style={buildLabelStyle(220, !isTooltip)}>
              <span style={LABEL_TEXT_STYLE}>{t('editor.tooltipPositionLabel')}</span>
              <select
                style={SELECT_STYLE}
                value={value?.tooltipPosition || 'top'}
                onChange={(event) => update({ tooltipPosition: event.target.value })}
              >
                <option value="top">{t('tooltip.position.top')}</option>
                <option value="right">{t('tooltip.position.right')}</option>
                <option value="bottom">{t('tooltip.position.bottom')}</option>
                <option value="left">{t('tooltip.position.left')}</option>
              </select>
            </label>

            <label style={buildLabelStyle(220, !isTooltip)}>
              <span style={LABEL_TEXT_STYLE}>{t('editor.tooltipPersistenceLabel')}</span>
              <label style={TOGGLE_ROW_STYLE}>
                <input
                  type="checkbox"
                  style={CHECKBOX_STYLE}
                  checked={Boolean(value?.tooltipPersistent)}
                  onChange={(event) => update({ tooltipPersistent: event.target.checked })}
                />
                <span style={{ fontSize: '13px', color: 'rgb(15, 23, 42)' }}>
                  {t('editor.tooltipPersistenceLabel')}
                </span>
              </label>
              <p style={TOGGLE_HINT_STYLE}>{t('editor.tooltipPersistenceHint')}</p>
            </label>

            <label style={buildLabelStyle(220, !isArea)}>
              <span style={LABEL_TEXT_STYLE}>{t('editor.areaLayoutLabel')}</span>
              <select
                style={SELECT_STYLE}
                value={value?.layout || 'row'}
                onChange={(event) => update({ layout: event.target.value })}
              >
                <option value="row">{t('editor.areaLayout.horizontal')}</option>
                <option value="column">{t('editor.areaLayout.vertical')}</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset style={FIELDSET_STYLE}>
          <legend style={LEGEND_STYLE}>{t('editor.stylesLegend')}</legend>
          <div style={FIELD_ROW_STYLE}>
            <label style={buildLabelStyle(260, false)}>
              <span style={LABEL_TEXT_STYLE}>{t('editor.styles.presetsLabel')}</span>
              <select
                style={SELECT_STYLE}
                value={value?.stylePreset || ''}
                onChange={(event) => applyPreset(event.target.value)}
              >
                {STYLE_PRESETS.map((preset) => (
                  <option key={preset.value || 'custom'} value={preset.value}>
                    {preset.labelKey ? t(preset.labelKey) : preset.value || t('editor.styles.presets.custom')}
                  </option>
                ))}
              </select>
            </label>

            {basicStyleFields.map(renderStyleField)}

            <p style={NOTE_STYLE}>{t('editor.stylesHint')}</p>
          </div>

          <details
            style={DETAILS_STYLE}
            open={advancedOpen}
            onToggle={(event) => setAdvancedOpen(event.target.open)}
          >
            <summary style={SUMMARY_STYLE}>{t('editor.stylesAdvancedToggle')}</summary>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'stretch' }}>
              {advancedStyleFields.map(renderStyleField)}
              <label style={buildLabelStyle(260, false)}>
                <span style={LABEL_TEXT_STYLE}>{t('editor.styles.customCss')}</span>
                <textarea
                  placeholder="color: #2563eb; text-transform: uppercase;"
                  style={{
                    width: '100%',
                    minHeight: '64px',
                    borderRadius: '10px',
                    border: '1px solid rgba(148, 163, 184, 0.6)',
                    background: 'rgba(241, 245, 249, 0.6)',
                    fontSize: '12px',
                    color: 'rgb(15, 23, 42)',
                    padding: '8px 10px',
                    boxSizing: 'border-box',
                  }}
                  value={customCss}
                  onChange={handleCustomCssChange}
                />
              </label>
            </div>
            <p style={ADVANCED_HINT_STYLE}>{t('editor.stylesAdvancedHint')}</p>
          </details>
        </fieldset>
      </section>
    </div>
  );
}
